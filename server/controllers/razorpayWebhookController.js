import crypto from 'crypto';
import User from '../models/User.js';
import SubscriptionAuditLog from '../models/SubscriptionAuditLog.js';
import logger from '../utils/logger.js';
import { invalidateUserAnalyticsCache } from './analyticsController.js';
import { RAZORPAY_PRICING } from '../services/razorpayService.js';
import { redisDel } from '../config/redis.js';

export const handleRazorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('RAZORPAY_WEBHOOK_SECRET is not set');
      return res.status(500).send('Webhook secret not configured');
    }

    const signature = req.headers['x-razorpay-signature'];
    if (!signature || typeof signature !== 'string') {
      return res.status(400).send('Missing or invalid signature');
    }

    // CRITICAL: Guard against missing rawBody (would silently hash 'undefined')
    if (!req.rawBody) {
      logger.error('[Razorpay Webhook] rawBody is missing — check body parser middleware order');
      return res.status(500).send('Raw body unavailable');
    }

    // Verify signature using timing-safe hex buffer comparison (same as verifyRazorpaySignature)
    const expectedBuf = Buffer.from(
      crypto.createHmac('sha256', webhookSecret).update(req.rawBody).digest('hex'),
      'hex'
    );
    const sigBuf = Buffer.from(signature, 'hex');

    if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
      logger.warn('[Razorpay Webhook] Invalid signature');
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    const eventName = event.event;
    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;
    
    // We only care about order.paid for the success flow
    if (eventName !== 'order.paid') {
      return res.status(200).send('Event not handled');
    }

    if (!orderEntity) {
      return res.status(400).send('Missing order entity');
    }

    const orderId = orderEntity.id;
    const paymentId = paymentEntity?.id;
    if (!paymentId) {
      logger.error(`[Razorpay Webhook] Missing payment entity for order ${orderId}`);
      return res.status(400).send('Missing payment entity in webhook payload');
    }
    const notes = orderEntity.notes || {};
    const { tier, interval, userId } = notes;

    if (!tier || !interval || !userId) {
      logger.error(`[Razorpay Webhook] Missing notes in order ${orderId}`);
      return res.status(400).send('Invalid order metadata');
    }

    // Validate tier + interval against authoritative pricing map (defense-in-depth)
    if (!RAZORPAY_PRICING[tier]?.[interval]) {
      logger.error(`[Razorpay Webhook] Invalid tier/interval in notes: ${tier}/${interval}`);
      return res.status(400).send('Invalid tier or interval in order notes');
    }

    logger.info(`[Razorpay Webhook] Processing ${eventName} for order ${orderId}`);

    // Atomic idempotency check (same pattern as verify)
    const previousUser = await User.findById(userId).select('subscription email snapId');
    if (!previousUser) {
      logger.error(`[Razorpay Webhook] User ${userId} not found for order ${orderId}`);
      return res.status(200).send('User not found - ignored'); // Return 200 to prevent retries
    }

    const previousSubscription = { ...previousUser.subscription?.toObject?.() };

    // Calculate correct period end using calendar math, not fixed milliseconds
    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    if (interval === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    let updatedUser;
    try {
      updatedUser = await User.findOneAndUpdate(
        {
          _id: userId,
          'subscription.razorpay.orderId': { $ne: orderId }, // Idempotency guard
        },
        {
          $set: {
            'subscription.tier': tier,
            'subscription.status': 'active',
            'subscription.billingCycle': interval,
            'subscription.gateway': 'razorpay',
            'subscription.currentPeriodStart': periodStart,
            'subscription.currentPeriodEnd': periodEnd,
            'subscription.razorpay.orderId': orderId,
            'subscription.razorpay.paymentId': paymentId,
          },
        },
        { new: true }
      );
    } catch (dupErr) {
      if (dupErr.code === 11000) {
        logger.info(`[Razorpay Webhook] Duplicate verify for order ${orderId} — already processed`);
        return res.status(200).send('Already processed');
      }
      throw dupErr;
    }

    if (!updatedUser) {
      logger.info(`[Razorpay Webhook] Order ${orderId} already applied by frontend verify`);
      return res.status(200).send('Already processed');
    }

    // Invalidate analytics and user cache if tier changed
    await invalidateUserAnalyticsCache(userId);
    await redisDel(`ls:user:${userId}`);

    // Write audit log
    await SubscriptionAuditLog.create({
      userId: updatedUser._id,
      userEmail: updatedUser.email,
      userSnapId: updatedUser.snapId,
      action: 'razorpay_payment',
      source: 'webhook',
      reason: `Razorpay webhook processed: ${orderId}`,
      previousData: previousSubscription,
      newData: {
        tier,
        status: 'active',
        billingCycle: interval,
        currentPeriodStart: updatedUser.subscription.currentPeriodStart,
        currentPeriodEnd: updatedUser.subscription.currentPeriodEnd,
        gateway: 'razorpay',
        subscriptionId: updatedUser.subscription.subscriptionId || null,
        customerId: updatedUser.subscription.customerId || null,
        variantId: updatedUser.subscription.variantId || null,
        razorpay: updatedUser.subscription.razorpay || null,
      },
    }).catch(err => logger.error(`[Razorpay Audit Log Error] ${err.message}`));

    logger.info(`[Razorpay Webhook] User ${updatedUser.snapId} upgraded to ${tier} (${interval})`);

    res.status(200).send('Success');

  } catch (error) {
    logger.error(`[Razorpay Webhook Error] ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
};
