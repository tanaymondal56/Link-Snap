import express from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../middleware/authMiddleware.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';
import { ipWhitelist } from '../middleware/ipWhitelist.js';
import {
    getPublicChangelogs,
    getPublicLatestVersion,
    getPublicRoadmap,
    getAllChangelogs,
    getChangelogById,
    createChangelog,
    updateChangelog,
    deleteChangelog,
    duplicateChangelog,
    togglePublish,
    getLatestVersion,
    bulkDeleteChangelogs,
    bulkPublishChangelogs,
    reorderChangelogs
} from '../controllers/changelogController.js';

const router = express.Router();

// Rate limiter for public endpoints (100 requests per 15 minutes per IP)
const publicRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Public routes - no auth required, rate limited
router.get('/', publicRateLimiter, getPublicChangelogs);
router.get('/version', publicRateLimiter, getPublicLatestVersion);
router.get('/roadmap', publicRateLimiter, getPublicRoadmap);

// Admin routes - require IP whitelist + auth + admin role
router.get('/admin', ipWhitelist, verifyToken, verifyAdmin, getAllChangelogs);
router.get('/admin/latest-version', ipWhitelist, verifyToken, verifyAdmin, getLatestVersion);
router.get('/admin/:id', ipWhitelist, verifyToken, verifyAdmin, getChangelogById);
router.post('/admin', ipWhitelist, verifyToken, verifyAdmin, createChangelog);
router.put('/admin/:id', ipWhitelist, verifyToken, verifyAdmin, updateChangelog);
router.delete('/admin/:id', ipWhitelist, verifyToken, verifyAdmin, deleteChangelog);
router.post('/admin/:id/duplicate', ipWhitelist, verifyToken, verifyAdmin, duplicateChangelog);
router.patch('/admin/:id/publish', ipWhitelist, verifyToken, verifyAdmin, togglePublish);

// Bulk operations
router.delete('/admin/bulk', ipWhitelist, verifyToken, verifyAdmin, bulkDeleteChangelogs);
router.patch('/admin/bulk/publish', ipWhitelist, verifyToken, verifyAdmin, bulkPublishChangelogs);
router.patch('/admin/reorder', ipWhitelist, verifyToken, verifyAdmin, reorderChangelogs);

export default router;
