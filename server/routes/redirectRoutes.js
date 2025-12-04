import express from 'express';
import { redirectUrl, previewUrl } from '../controllers/redirectController.js';
import { redirectLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// List of known frontend routes and paths to skip
const SKIP_PATHS = [
    'login',
    'register',
    'dashboard',
    'admin',
    'analytics',
    'verify-email',
    'forgot-password',
    'reset-password',
    'changelog',
    'privacy',
    'terms',
    'account-suspended',
    'assets',
    'favicon.ico',
    'favicon.svg',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'robots.txt',
    'manifest.json',
    'manifest.webmanifest',
    'sw.js',
    'workbox-',
    'pwa-',
    'apple-touch-icon',
];

// File extensions that should never be treated as short URLs
const SKIP_EXTENSIONS = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.map', '.json', '.txt', '.xml'];

// Middleware to skip redirect for known frontend routes and static files
const skipFrontendRoutes = (req, res, next) => {
    const path = req.params.shortId?.toLowerCase() || req.params[0]?.toLowerCase();

    if (!path) {
        return next();
    }

    // Skip if path has a file extension (static files)
    if (SKIP_EXTENSIONS.some(ext => path.endsWith(ext))) {
        return next('route');
    }

    // Skip if path starts with any known frontend route
    if (SKIP_PATHS.some(skip => path.startsWith(skip.toLowerCase()))) {
        return next('route'); // Skip to next route handler
    }

    next();
};

// Preview page routes (when user adds + at the end)
// Using regex pattern to match shortId followed by +
router.get(/^\/([a-zA-Z0-9_-]+)\+$/, skipFrontendRoutes, redirectLimiter, previewUrl);

// Regular redirect route (also handles trailing slash via Express normalization)
router.get('/:shortId', skipFrontendRoutes, redirectLimiter, redirectUrl);

export default router;
