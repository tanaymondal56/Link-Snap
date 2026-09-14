import express from 'express';
import { getPricing, createCheckoutSession, syncSubscription } from '../controllers/subscriptionController.js';
import { redeemCode, validateRedeemCode } from '../controllers/redeemCodeController.js';
import { protect } from '../middleware/authMiddleware.js';
import { getUserIP } from '../middleware/strictProxyGate.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limit for checkout creation (5 per minute per user + IP)
const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 5,
  message: { message: 'Too many checkout attempts. Please try again in a minute.' },
  keyGenerator: (req) => `${req.user?._id || 'guest'}:${getUserIP(req)}`,
  validate: { keyGeneratorIpFallback: false },
});

// Rate limit for redemption (10 per hour per user + IP to prevent brute-force account cycling)
const redeemLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 10,
  message: { message: 'Too many redemption attempts. Please try again later.' },
  keyGenerator: (req) => `${req.user?._id || 'guest'}:${getUserIP(req)}`,
  validate: { keyGeneratorIpFallback: false },
});

// Public route to get pricing configuration
router.get('/pricing', getPricing);

// Protected routes
router.post('/checkout', protect, checkoutLimiter, createCheckoutSession);
router.post('/redeem', protect, redeemLimiter, redeemCode);
router.post('/redeem/validate', protect, redeemLimiter, validateRedeemCode);
router.post('/sync', protect, syncSubscription);

export default router;

