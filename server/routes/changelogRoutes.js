import express from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../middleware/authMiddleware.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';
import { ipWhitelist } from '../middleware/ipWhitelist.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
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
    reorderChangelogs,
    voteRoadmapItem,
    unvoteRoadmapItem,
    bulkImportChangelogs
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

// Rate limiter for voting (30 per minute per user)
const voteLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: { message: 'Too many vote attempts. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?._id?.toString() || req.ip,
    validate: false
});

// Rate limiter for JSON imports (20 per hour per admin) — imports are heavy
const importRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { message: 'Too many imports. Please wait before importing again.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?._id?.toString() || req.ip,
    validate: false
});

// Public routes - no auth required, rate limited
router.get('/', publicRateLimiter, getPublicChangelogs);
router.get('/version', publicRateLimiter, getPublicLatestVersion);
router.get('/roadmap', publicRateLimiter, optionalAuth, getPublicRoadmap);

// Upvoting routes (require authentication)
router.post('/roadmap/:id/vote', verifyToken, voteLimiter, voteRoadmapItem);
router.delete('/roadmap/:id/vote', verifyToken, voteLimiter, unvoteRoadmapItem);

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

// Bulk JSON import (create new + update existing by version).
// NOTE: the body for this route is parsed by a scoped 256KB express.json
// mounted in index.js BEFORE the global 10kb parser — large import files
// would otherwise be rejected with 413 before reaching this router.
router.post(
    '/admin/import',
    ipWhitelist,
    verifyToken,
    verifyAdmin,
    importRateLimiter,
    bulkImportChangelogs
);

export default router;
