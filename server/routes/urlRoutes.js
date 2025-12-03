import express from 'express';
import { createShortUrl, getMyLinks, deleteUrl, checkAliasAvailability, updateUrl } from '../controllers/urlController.js';
import { protect } from '../middleware/authMiddleware.js';
import { createLinkLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public/Private route (Controller handles user check)
// We need a middleware that optionally attaches user but doesn't block
const optionalAuth = async (req, res, next) => {
    // Reuse protect logic but don't error if no token
    // For now, let's just use protect for authenticated routes and a separate one for public
    // Actually, the controller checks req.user. 
    // Let's use a custom middleware or just rely on the fact that `protect` throws error.
    // We'll make two routes: /shorten (public) and /shorten/auth (private)? 
    // No, better to have one.

    // Simple optional auth middleware
    import('jsonwebtoken').then(async ({ default: jwt }) => {
        import('../models/User.js').then(async ({ default: User }) => {
            if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
                try {
                    const token = req.headers.authorization.split(' ')[1];
                    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
                    req.user = await User.findById(decoded.id).select('-password');
                } catch (error) {
                    // Invalid token, treat as anonymous
                }
            }
            next();
        });
    });
};

router.post('/shorten', optionalAuth, createLinkLimiter, createShortUrl);
router.get('/my-links', protect, getMyLinks);
router.get('/check-alias/:alias', protect, checkAliasAvailability);
router.put('/:id', protect, updateUrl);
router.delete('/:id', protect, deleteUrl);

export default router;
