import express from 'express';
import { createShortUrl, getMyLinks, deleteUrl, checkAliasAvailability, updateUrl, verifyLinkPassword } from '../controllers/urlController.js';
import { protect } from '../middleware/authMiddleware.js';
import { createLinkLimiter, passwordVerifyLimiter } from '../middleware/rateLimiter.js';
import { checkLinkLimit } from '../middleware/subscriptionMiddleware.js';

const router = express.Router();

// Public/Private route (Controller handles user check)
// We need a middleware that optionally attaches user but doesn't block
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Public/Private route (Controller handles user check)
// We need a middleware that optionally attaches user but doesn't block
const optionalAuth = async (req, res, next) => {
    // Reuse protect logic but don't error if no token
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
        } catch {
            // Invalid token, treat as anonymous
        }
    }
    next();
};

router.post('/shorten', optionalAuth, createLinkLimiter, checkLinkLimit, createShortUrl);
router.get('/my-links', protect, getMyLinks);
router.get('/check-alias/:alias', protect, checkAliasAvailability);
router.put('/:id', protect, updateUrl);
router.delete('/:id', protect, deleteUrl);

// Password verification for protected links (public, rate limited)
router.post('/:shortId/verify-password', passwordVerifyLimiter, verifyLinkPassword);

export default router;
