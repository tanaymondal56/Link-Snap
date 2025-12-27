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
  resendOTP,
  forgotPassword,
  resetPassword,
  checkUsernameAvailability,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authLimiter, verifyOtpLimiter, forgotPasswordLimiter, resetPasswordLimiter, refreshLimiter, profileUpdateLimiter, usernameCheckLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/logout', logoutUser);
router.get('/refresh', refreshLimiter, refreshAccessToken);
router.get('/me', protect, getMe);
router.put('/me', protect, profileUpdateLimiter, updateProfile);
router.put('/change-password', protect, changePassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/verify-otp', verifyOtpLimiter, verifyOTP);
router.post('/resend-otp', verifyOtpLimiter, resendOTP);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPasswordLimiter, resetPassword);
router.get('/check-username/:username', usernameCheckLimiter, checkUsernameAvailability);

export default router;
