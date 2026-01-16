import express from 'express';
import { redirectUrl, previewUrl } from '../controllers/redirectController.js';
import { redirectLimiter } from '../middleware/rateLimiter.js';
import logger from '../utils/logger.js';

const router = express.Router();

// List of known frontend routes and paths to skip
// List of known frontend routes to skip (Exact Match)
const EXACT_SKIP_PATHS = new Set([
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
    'apple-touch-icon',
]);

// Prefixes to skip (System/Assets)
const PREFIX_SKIP_PATHS = [
    'workbox-',
    'pwa-',
];

// File extensions that should never be treated as short URLs
const SKIP_EXTENSIONS = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.map', '.json', '.txt', '.xml'];

// Middleware to skip redirect for known frontend routes and static files
const skipFrontendRoutes = (req, res, next) => {
    const path = req.params.shortId?.toLowerCase() || req.params[0]?.toLowerCase();

    if (!path) {
        return next();
    }

    // Skip if path starts with @ (bio profile pages handled by SPA)
    if (path.startsWith('@')) {
        return next('route');
    }

    // Skip if path has a file extension (static files)
    if (SKIP_EXTENSIONS.some(ext => path.endsWith(ext))) {
        return next('route');
    }

    // 1. Check Exact Matches (User Pages)
    // Fixes bug where 'login-party' was blocked by 'login' prefix
    if (EXACT_SKIP_PATHS.has(path)) {
        return next('route');
    }

    // 2. Check Prefix Matches (System/Assets only)
    if (PREFIX_SKIP_PATHS.some(prefix => path.startsWith(prefix))) {
        return next('route'); 
    }

    next();
};

// Preview page routes (when user adds + at the end)
// Using regex pattern to match shortId followed by +
router.get(/^\/([a-zA-Z0-9_-]+)\+$/, skipFrontendRoutes, redirectLimiter, previewUrl);

// Development-only shortcut codes (only in development mode)
if (process.env.NODE_ENV !== 'production') {
    const DEV_SHORTCUTS = {
        '-admin': '/admin-console',      // Admin console
        '-console': '/admin-console',    // Admin console (alias)
        '-legacy': '/admin',             // Legacy admin panel
        '-dev': '/dashboard',            // Dashboard
        '-settings': '/dashboard/settings', // Settings page
        // Easter egg shortcuts
        '-credits': '/easter/credits',    // Credits page
        '-timeline': '/easter/timeline',  // Timeline page
        '-thanks': '/easter/thanks',      // Thank you page
        '-coffee': 'https://buymeacoffee.com', // Buy me coffee
        '-jobs': '/dev/null',             // Funny job application
        '-devnull': '/dev/null',          // Same as above
        '-apply': '/dev/null',            // Same as above
    };
    
    // Easter egg: Rickroll
    const RICKROLL_URLS = ['-rickroll', '-rick', '-never', '-gonna'];

    router.get('/:shortId', (req, res, next) => {
        const shortId = req.params.shortId?.toLowerCase();
        
        // Rickroll Easter egg
        if (RICKROLL_URLS.includes(shortId)) {
            logger.debug(`[Easter Egg] Rickrolled! ${shortId}`);
            return res.redirect('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        }
        
        // Dev shortcuts
        if (shortId && DEV_SHORTCUTS[shortId]) {
            logger.debug(`[Dev Shortcut] ${shortId} -> ${DEV_SHORTCUTS[shortId]}`);
            return res.redirect(DEV_SHORTCUTS[shortId]);
        }
        next();
    });
}

// Regular redirect route (also handles trailing slash via Express normalization)
router.get('/:shortId', skipFrontendRoutes, redirectLimiter, redirectUrl);

export default router;
