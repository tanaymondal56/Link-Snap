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
import { globalRegisterCircuitBreaker, authLimiter, verifyOtpLimiter, forgotPasswordLimiter, resetPasswordLimiter, refreshLimiter, profileUpdateLimiter, usernameCheckLimiter, passwordChangeLimiter, logoutLimiter } from '../middleware/rateLimiter.js';
import { dualLayerLoginLimiter, dualLayerAuthActionLimiter } from '../middleware/dualLayerAuthRateLimiter.js';

const router = express.Router();

router.post('/register', globalRegisterCircuitBreaker, authLimiter, dualLayerAuthActionLimiter, registerUser);
router.post('/login', authLimiter, dualLayerLoginLimiter, loginUser);
router.post('/logout', logoutLimiter, logoutUser);
router.post('/refresh', refreshLimiter, refreshAccessToken);
router.get('/me', protect, getMe);
router.put('/me', protect, profileUpdateLimiter, updateProfile);
router.put('/change-password', protect, passwordChangeLimiter, dualLayerAuthActionLimiter, changePassword);
router.get('/verify-email/:token', verifyOtpLimiter, verifyEmail);
router.post('/verify-otp', verifyOtpLimiter, dualLayerAuthActionLimiter, verifyOTP);
router.post('/resend-otp', verifyOtpLimiter, dualLayerAuthActionLimiter, resendOTP);
router.post('/forgot-password', forgotPasswordLimiter, dualLayerAuthActionLimiter, forgotPassword);
router.post('/reset-password', resetPasswordLimiter, dualLayerAuthActionLimiter, resetPassword);
router.get('/check-username/:username', usernameCheckLimiter, checkUsernameAvailability);

export default router;
