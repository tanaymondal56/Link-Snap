import express from 'express';
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  getMe,
  updateProfile,
  changePassword,
  verifyEmail,
  verifyOTP,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authLimiter, verifyOtpLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/logout', logoutUser);
router.get('/refresh', refreshAccessToken);
router.get('/me', protect, getMe);
router.put('/me', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/verify-otp', verifyOtpLimiter, verifyOTP);

export default router;
