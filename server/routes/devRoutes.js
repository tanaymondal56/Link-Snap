import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  // Signup info generators
  devGetRandomSignupInfo,
  devGetExistingSignupInfo,
  devGetUnverifiedSignupInfo,
  // Status & Health
  devStatus,
  devQuickLogin,
  devVerifySelf,
  devToggleVerification,
  devClearSessions,
  // User seeding
  devSeedUsers,
  devDeleteTestUsers,
  // Analytics
  devGenerateAnalytics,
  devClearAnalytics,
  // Subscription (existing)
  devUpgradeSelf,
  devResetSelf,
  devClearRedeemHistory,
  // Bulk links (existing)
  devCreateTestLinks,
  devGetTestLinks,
  devDeleteTestLinks
} from '../controllers/devController.js';

const router = express.Router();

// DOUBLE SECURITY: Failsafe middleware
// Even if this file is loaded, strictly block access if not in development mode
router.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ message: 'Dev routes are disabled in production' });
  }
  next();
});

// ============================================
// PUBLIC DEV ROUTES (no auth required)
// ============================================

// Signup info generators (for quickly filling signup forms)
router.get('/signup-info/random', devGetRandomSignupInfo);      // Random new user info
router.get('/signup-info/existing', devGetExistingSignupInfo);  // Existing user (test duplicate prevention)
router.get('/signup-info/unverified', devGetUnverifiedSignupInfo); // Unverified user (test resend flow)

// Quick login (creates user if needed, returns tokens)
router.post('/quick-login', devQuickLogin);

// Toggle email verification globally (useful before creating users - no auth required)
router.post('/toggle-verification', devToggleVerification);

// ============================================
// PROTECTED DEV ROUTES (auth required)
// ============================================

router.use(protect);

// Status & Info
router.get('/status', devStatus);

// Self-service verification
router.post('/verify-self', devVerifySelf);

// Session management
router.delete('/sessions', devClearSessions);

// Subscription overrides
router.post('/subscription/upgrade', devUpgradeSelf);
router.post('/subscription/reset', devResetSelf);
router.post('/subscription/clear-history', devClearRedeemHistory);

// Test user seeding
router.post('/seed-users', devSeedUsers);
router.delete('/seed-users', devDeleteTestUsers);

// Analytics generation & cleanup
router.post('/analytics', devGenerateAnalytics);
router.delete('/analytics', devClearAnalytics);

// Bulk test link management
router.post('/links', devCreateTestLinks);
router.get('/links', devGetTestLinks);
router.delete('/links', devDeleteTestLinks);

export default router;
