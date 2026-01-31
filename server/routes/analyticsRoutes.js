import express from 'express';
import { getUrlAnalytics } from '../controllers/analyticsController.js';
import { trackEdgeClick, trackBulkClicks } from '../controllers/edgeAnalyticsController.js';
import { protect } from '../middleware/authMiddleware.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ══════════════════════════════════════════════════════════════════════════════
// EDGE ANALYTICS - Called by Nginx mirror (no auth required, internal only)
// ══════════════════════════════════════════════════════════════════════════════
// These endpoints are called by Nginx edge proxy for every redirect request
// They respond immediately (fire-and-forget) to not block the user

// Internal-only middleware: Validates secret header from Nginx proxy
// Set INTERNAL_ANALYTICS_SECRET in .env and configure Nginx to send it
const internalOnly = (req, res, next) => {
    const secret = req.headers['x-internal-analytics-secret'];
    const expectedSecret = process.env.INTERNAL_ANALYTICS_SECRET;
    
    // In development, allow requests without secret for testing
    if (process.env.NODE_ENV === 'development' && !expectedSecret) {
        return next();
    }
    
    if (!expectedSecret) {
        logger.warn('[EdgeAnalytics] INTERNAL_ANALYTICS_SECRET not configured');
        return res.status(503).end();
    }
    
    if (secret !== expectedSecret) {
        // Silent fail - don't reveal endpoint exists to attackers
        return res.status(404).end();
    }
    
    next();
};

// Track single click from edge proxy mirror
// POST /api/analytics/track/:shortCode
router.post('/track/:shortCode', internalOnly, trackEdgeClick);

// Bulk import clicks (for log processing)
// POST /api/analytics/track-bulk
router.post('/track-bulk', internalOnly, trackBulkClicks);

// ══════════════════════════════════════════════════════════════════════════════
// USER ANALYTICS - Protected routes for dashboard
// ══════════════════════════════════════════════════════════════════════════════

// Protected route to get analytics for a specific URL
router.get('/:shortId', protect, getUrlAnalytics);

export default router;
