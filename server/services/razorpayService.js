import Razorpay from 'razorpay';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

// ── Singleton client ────────────────────────────────────────────
export const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Authoritative pricing map (paise, INR) ──────────────────────
// NEVER send amounts from the frontend — use this map exclusively
export const RAZORPAY_PRICING = {
  pro: {
    monthly: { amount: 75000,  currency: 'INR', display: '₹750' },
    yearly:  { amount: 750000, currency: 'INR', display: '₹7,500' },
    one_time: { amount: 75000,  currency: 'INR', display: '₹750' },
  },
};

// ── Create a Razorpay order ────────────────────────────────────
export const createRazorpayOrder = async ({ tier, interval, userId, snapId }) => {
  const pricing = RAZORPAY_PRICING[tier]?.[interval];
  if (!pricing) throw new Error(`Unknown tier/interval: ${tier}/${interval}`);

  return razorpay.orders.create({
    amount:   pricing.amount,
    currency: pricing.currency,
    receipt:  `rzp_rcpt_${nanoid(10)}`,
    notes: {
      tier,
      interval,
      userId:  userId.toString(),
      snapId,
    },
  });
};

// ── Create a Razorpay subscription ─────────────────────────────
export const createRazorpaySubscription = async ({ tier, interval, userId, snapId }) => {
  let planId;
  if (tier === 'pro') {
    if (interval === 'monthly') planId = process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID;
    if (interval === 'yearly') planId = process.env.RAZORPAY_PRO_YEARLY_PLAN_ID;
  }

  // Fallback to order creation if Plan IDs are not configured (prevents complete failure)
  if (!planId) {
    return {
      fallbackToOrder: true,
      order: await createRazorpayOrder({ tier, interval, userId, snapId })
    };
  }

  const sub = await razorpay.subscriptions.create({
    plan_id: planId,
    total_count: interval === 'yearly' ? 10 : 120, // Limit to 10 years
    quantity: 1,
    customer_notify: 1,
    notes: {
      tier,
      interval,
      userId: userId.toString(),
      snapId,
    },
  });

  return { fallbackToOrder: false, subscription: sub };
};

// ── Verify HMAC-SHA256 signature for orders (timing-safe) ──────
export const verifyRazorpaySignature = ({ orderId, paymentId, signature }) => {
  if (typeof signature !== 'string') return false;

  const expectedBuf = Buffer.from(
    crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex'),
    'hex'
  );

  let signatureBuf;
  try {
    signatureBuf = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }

  if (expectedBuf.length !== signatureBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
};

// ── Verify HMAC-SHA256 signature for subscriptions (timing-safe) ──────
export const verifyRazorpaySubscriptionSignature = ({ subscriptionId, paymentId, signature }) => {
  if (typeof signature !== 'string') return false;

  const expectedBuf = Buffer.from(
    crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${paymentId}|${subscriptionId}`)
      .digest('hex'),
    'hex'
  );

  let signatureBuf;
  try {
    signatureBuf = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }

  if (expectedBuf.length !== signatureBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
};
