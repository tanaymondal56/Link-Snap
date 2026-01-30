import express from 'express';
import { getUrlAnalytics } from '../controllers/analyticsController.js';
import { trackEdgeClick, trackBulkClicks } from '../controllers/edgeAnalyticsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ══════════════════════════════════════════════════════════════════════════════
// EDGE ANALYTICS - Called by Nginx mirror (no auth required, internal only)
// ══════════════════════════════════════════════════════════════════════════════
// These endpoints are called by Nginx edge proxy for every redirect request
// They respond immediately (fire-and-forget) to not block the user

// Track single click from edge proxy mirror
// POST /api/analytics/track/:shortCode
router.post('/track/:shortCode', trackEdgeClick);

// Bulk import clicks (for log processing)
// POST /api/analytics/track-bulk
router.post('/track-bulk', trackBulkClicks);

// ══════════════════════════════════════════════════════════════════════════════
// USER ANALYTICS - Protected routes for dashboard
// ══════════════════════════════════════════════════════════════════════════════

// Protected route to get analytics for a specific URL
router.get('/:shortId', protect, getUrlAnalytics);

export default router;
