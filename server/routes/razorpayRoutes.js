import express from 'express';
import { createOrder, verifyPayment } from '../controllers/razorpayController.js';
import { protect } from '../middleware/authMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limit: 5 order attempts per minute per user
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: 'Too many payment attempts. Please try again in a minute.' },
  keyGenerator: (req) => req.user?._id?.toString() || 'guest',
});

// Rate limit: 10 verify attempts per minute per user
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: 'Too many verification attempts.' },
  keyGenerator: (req) => req.user?._id?.toString() || 'guest',
});

router.post('/order',  protect, orderLimiter,  createOrder);
router.post('/verify', protect, verifyLimiter, verifyPayment);

export default router;
