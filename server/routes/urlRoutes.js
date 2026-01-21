import express from 'express';
import { createShortUrl, getMyLinks, deleteUrl, checkAliasAvailability, updateUrl, verifyLinkPassword } from '../controllers/urlController.js';
import { protect } from '../middleware/authMiddleware.js';
import { createLinkLimiter, passwordVerifyLimiter } from '../middleware/rateLimiter.js';
import { checkLinkLimit } from '../middleware/subscriptionMiddleware.js';

const router = express.Router();

// Public/Private route (Controller handles user check)
// We need a middleware that optionally attaches user but doesn't block
// Public/Private route (Controller handles user check)
// Using shared middleware to check for token without blocking
import { optionalAuth } from '../middleware/optionalAuth.js';

router.post('/shorten', optionalAuth, createLinkLimiter, checkLinkLimit, createShortUrl);
router.get('/my-links', protect, getMyLinks);
router.get('/check-alias/:alias', protect, checkAliasAvailability);
router.put('/:id', protect, updateUrl);
router.delete('/:id', protect, deleteUrl);

// Password verification for protected links (public, rate limited)
router.post('/:shortId/verify-password', passwordVerifyLimiter, verifyLinkPassword);

export default router;
