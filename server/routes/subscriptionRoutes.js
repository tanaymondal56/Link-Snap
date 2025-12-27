import express from 'express';
import { getPricing, createCheckoutSession, syncSubscription } from '../controllers/subscriptionController.js';
import { redeemCode } from '../controllers/redeemCodeController.js';
import { protect } from '../middleware/authMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limit for checkout creation (5 per minute per user)
const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { message: 'Too many checkout attempts. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user ? req.user._id.toString() : 'guest'
});

// Public route to get pricing configuration
router.get('/pricing', getPricing);

// Protected routes
router.post('/checkout', protect, checkoutLimiter, createCheckoutSession);
router.post('/redeem', protect, redeemCode);
router.post('/sync', protect, syncSubscription);

export default router;

