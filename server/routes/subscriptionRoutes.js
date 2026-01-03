import express from 'express';
import { getPricing, createCheckoutSession, syncSubscription } from '../controllers/subscriptionController.js';
import { redeemCode, validateRedeemCode } from '../controllers/redeemCodeController.js';
import { protect } from '../middleware/authMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limit for checkout creation (5 per minute per user)
// Rate limit for checkout (5 per minute)
const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 5,
  message: { message: 'Too many checkout attempts. Please try again in a minute.' },
  keyGenerator: (req) => req.user ? req.user._id.toString() : 'guest'
});

// Rate limit for redemption (10 per hour to prevent bruteforce)
const redeemLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 10,
  message: { message: 'Too many redemption attempts. Please try again later.' },
  keyGenerator: (req) => req.user ? req.user._id.toString() : 'guest'
});

// Public route to get pricing configuration
router.get('/pricing', getPricing);

// Protected routes
router.post('/checkout', protect, checkoutLimiter, createCheckoutSession);
router.post('/redeem', protect, redeemLimiter, redeemCode);
router.post('/redeem/validate', protect, redeemLimiter, validateRedeemCode);
router.post('/sync', protect, syncSubscription);

export default router;

