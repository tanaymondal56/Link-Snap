import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { devLimiter } from '../middleware/rateLimiter.js';
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

// Apply developer-specific rate limiter to all developer routes
router.use(devLimiter);

// DOUBLE SECURITY: Failsafe middleware
// Strictly limit access to local testing only. Rejects any non-development environment
// and non-localhost hostnames with HTTP 404 Not Found (preserving Ghost Mode).
router.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ message: 'Not found' });
  }

  const checkLocal = (val) => {
    if (!val || typeof val !== 'string') return true;
    for (const part of val.split(',')) {
      let clean = part.trim();
      if (!clean) continue;
      if (clean.startsWith('http://') || clean.startsWith('https://')) {
        try {
          clean = new URL(clean).hostname;
        } catch {
          return false;
        }
      } else if (clean.startsWith('[') && clean.includes(']')) {
        clean = clean.substring(1, clean.indexOf(']'));
      } else {
        clean = clean.split(':')[0];
      }
      clean = clean.toLowerCase();
      const isLoopback =
        clean === 'localhost' ||
        clean === '127.0.0.1' ||
        clean === '::1' ||
        clean === '[::1]';
      if (!isLoopback) return false;
    }
    return true;
  };

  const hostsToCheck = [
    req.headers['host'],
    req.headers['x-forwarded-host'],
    req.headers['origin'],
    req.headers['referer'],
    req.hostname,
  ];

  for (const h of hostsToCheck) {
    if (h && !checkLocal(h)) {
      return res.status(404).json({ message: 'Not found' });
    }
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
