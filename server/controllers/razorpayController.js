import User from '../models/User.js';
import { getEffectiveTier } from '../services/subscriptionService.js';
import SubscriptionAuditLog from '../models/SubscriptionAuditLog.js';
import logger from '../utils/logger.js';
import { invalidateUserAnalyticsCache } from './analyticsController.js';
import {
  createRazorpayOrder,
  createRazorpaySubscription,
  verifyRazorpaySignature,
  verifyRazorpaySubscriptionSignature,
  razorpay,
  RAZORPAY_PRICING,
} from '../services/razorpayService.js';

// ── POST /api/razorpay/order ─────────────────────────────────────
export const createOrder = async (req, res) => {
  try {
    const { tier = 'pro', interval = 'monthly' } = req.body;
    const user = req.user;

    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    // Validate tier + interval server-side (NEVER trust client amount)
    if (!RAZORPAY_PRICING[tier]?.[interval]) {
      return res.status(400).json({ message: 'Invalid tier or billing interval' });
    }

    // Prevent duplicate active subscriptions — block all paid statuses, not just 'active'
    // Use getEffectiveTier to correctly handle expired subscriptions
    const isAlreadyPaid = getEffectiveTier(user) !== 'free';
    if (isAlreadyPaid) {
      return res.status(400).json({ message: 'You already have an active subscription' });
    }

    if (interval === 'one_time') {
      const order = await createRazorpayOrder({
        tier, interval,
        userId: user._id,
        snapId: user.snapId,
      });

      logger.info(`[Razorpay] One-time Order ${order.id} created for user ${user.snapId}`);
      return res.json({
        type: 'order',
        orderId:  order.id,
        amount:   order.amount,
        currency: order.currency,
        keyId:    process.env.RAZORPAY_KEY_ID,
      });
    }

    // Otherwise, create a recurring subscription
    const result = await createRazorpaySubscription({
      tier, interval,
      userId: user._id,
      snapId: user.snapId,
    });

    if (result.fallbackToOrder) {
      logger.info(`[Razorpay] Subscription Plan ID missing. Fell back to Order ${result.order.id} for user ${user.snapId}`);
      return res.json({
        type: 'order',
        orderId:  result.order.id,
        amount:   result.order.amount,
        currency: result.order.currency,
        keyId:    process.env.RAZORPAY_KEY_ID,
        fallback: true
      });
    }

    logger.info(`[Razorpay] Subscription ${result.subscription.id} created for user ${user.snapId}`);
    res.json({
      type: 'subscription',
      subscriptionId: result.subscription.id,
      keyId:          process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    logger.error(`[Razorpay Order Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to create payment order' });
  }
};

// ── POST /api/razorpay/verify ────────────────────────────────────
export const verifyPayment = async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_subscription_id, 
      razorpay_payment_id, 
      razorpay_signature 
    } = req.body;

    // 1. Validate required fields and types
    if (!razorpay_payment_id || !razorpay_signature || (!razorpay_order_id && !razorpay_subscription_id)) {
      return res.status(400).json({ message: 'Missing payment verification fields' });
    }
    if (typeof razorpay_payment_id !== 'string' || typeof razorpay_signature !== 'string') {
      return res.status(400).json({ message: 'Invalid payment verification format' });
    }

    const isSubscription = !!razorpay_subscription_id;
    const targetId = isSubscription ? razorpay_subscription_id : razorpay_order_id;

    // 2. Verify HMAC signature (timing-safe)
    const isValid = isSubscription
      ? verifyRazorpaySubscriptionSignature({
          subscriptionId: razorpay_subscription_id,
          paymentId:      razorpay_payment_id,
          signature:      razorpay_signature,
        })
      : verifyRazorpaySignature({
          orderId:   razorpay_order_id,
          paymentId: razorpay_payment_id,
          signature: razorpay_signature,
        });

    if (!isValid) {
      logger.warn(`[Razorpay] Signature mismatch for ${isSubscription ? 'subscription' : 'order'} ${targetId}`);
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    // 3. Fetch trusted metadata from Razorpay (never trust client-sent tier)
    let tier, interval, userId;
    if (isSubscription) {
      const subDetails = await razorpay.subscriptions.fetch(razorpay_subscription_id);
      ({ tier, interval, userId } = subDetails.notes || {});
    } else {
      const orderDetails = await razorpay.orders.fetch(razorpay_order_id);
      ({ tier, interval, userId } = orderDetails.notes || {});
    }

    if (!tier || !interval || !userId) {
      logger.error(`[Razorpay] Missing notes in payment ${targetId}`);
      return res.status(400).json({ message: 'Invalid payment metadata' });
    }

    // Validate tier + interval against authoritative pricing map (defense-in-depth)
    if (!RAZORPAY_PRICING[tier]?.[interval]) {
      logger.error(`[Razorpay] Invalid tier/interval in notes: ${tier}/${interval}`);
      return res.status(400).json({ message: 'Invalid tier or interval in payment metadata' });
    }

    // 4. Atomic upgrade with idempotency guard
    const previousUser = await User.findById(userId).select('subscription email snapId');
    if (!previousUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const previousSubscription = { ...previousUser.subscription?.toObject?.() };

    let updatedUser;
    try {
      const query = isSubscription
        ? { _id: userId, 'subscription.subscriptionId': { $ne: razorpay_subscription_id } }
        : { _id: userId, 'subscription.razorpay.orderId': { $ne: razorpay_order_id } };

      const updatePayload = {
        'subscription.tier':                  tier,
        'subscription.status':                'active',
        'subscription.billingCycle':          interval,
        'subscription.gateway':               'razorpay',
        'subscription.currentPeriodStart':    new Date(),
        'subscription.currentPeriodEnd':      (() => {
          const d = new Date();
          if (interval === 'yearly') d.setFullYear(d.getFullYear() + 1);
          else d.setMonth(d.getMonth() + 1);
          return d;
        })(),
        'subscription.razorpay.paymentId':    razorpay_payment_id,
      };

      if (isSubscription) {
        updatePayload['subscription.subscriptionId'] = razorpay_subscription_id;
      } else {
        updatePayload['subscription.razorpay.orderId'] = razorpay_order_id;
      }

      updatedUser = await User.findOneAndUpdate(query, { $set: updatePayload }, { new: true });
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        logger.info(`[Razorpay] Duplicate verify for ${targetId} — already processed`);
        return res.json({ success: true, message: 'Payment already verified' });
      }
      throw dupErr;
    }

    if (!updatedUser) {
      logger.info(`[Razorpay] Payment ${targetId} already applied`);
      return res.json({ success: true, message: 'Payment already verified' });
    }

    // 5. Invalidate analytics cache if tier changed
    await invalidateUserAnalyticsCache(userId);

    // 6. Write audit log
    await SubscriptionAuditLog.create({
      userId:       updatedUser._id,
      userEmail:    updatedUser.email,
      userSnapId:   updatedUser.snapId,
      action:       'razorpay_payment',
      source:       'user',
      reason:       `Razorpay payment verified: ${razorpay_payment_id}`,
      previousData: previousSubscription,
      newData: {
        tier,
        status: 'active',
        billingCycle: interval,
        currentPeriodStart: updatedUser.subscription.currentPeriodStart,
        currentPeriodEnd:   updatedUser.subscription.currentPeriodEnd,
      },
    }).catch(err => logger.error(`[Razorpay Audit Log Error] ${err.message}`));

    logger.info(`[Razorpay] User ${updatedUser.snapId} upgraded to ${tier} (${interval})`);

    res.json({
      success:    true,
      message:    'Payment verified and subscription activated',
      tier,
      interval,
      paymentId:  razorpay_payment_id,
    });
  } catch (error) {
    logger.error(`[Razorpay Verify Error] ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Payment verification failed' });
  }
};
