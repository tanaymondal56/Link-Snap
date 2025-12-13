import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';
import { ipWhitelist } from '../middleware/ipWhitelist.js';
import {
    getSystemStats,
    getAllUsers,
    deleteUser,
    updateUserStatus,
    updateUserRole,
    getSettings,
    updateSettings,
    testEmailConfiguration,
    clearUrlCache,
    createUser,
    getUserBanHistory,
    getUserAppeals,
    getAllAppeals,
    respondToAppeal,
    getAllFeedback,
    getFeedbackStats,
    updateFeedback,
    deleteFeedback,
    exportFeedbackCSV
} from '../controllers/adminController.js';
import { getAllLinks, updateLinkStatus, deleteLinkAdmin } from '../controllers/adminLinkController.js';

const router = express.Router();

// Security: IP Whitelist -> Auth -> Admin Role
router.use(ipWhitelist, verifyToken, verifyAdmin);

// Stats
router.get('/stats', getSystemStats);

// User Management
router.get('/users', getAllUsers);
router.post('/users', createUser);
router.delete('/users/:userId', deleteUser);
router.patch('/users/:userId/status', updateUserStatus);
router.patch('/users/:userId/role', updateUserRole);
router.get('/users/:userId/ban-history', getUserBanHistory);
router.get('/users/:userId/appeals', getUserAppeals);

// Link Management
router.get('/links', getAllLinks);
router.patch('/links/:linkId/status', updateLinkStatus);
router.delete('/links/:linkId', deleteLinkAdmin);

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.post('/settings/test-email', testEmailConfiguration);

// Cache
router.post('/cache/clear', clearUrlCache);

// Appeals
router.get('/appeals', getAllAppeals);
router.post('/appeals/:appealId/respond', respondToAppeal);

// Feedback Management
router.get('/feedback/export', exportFeedbackCSV);
router.get('/feedback', getAllFeedback);
router.get('/feedback/stats', getFeedbackStats);
router.patch('/feedback/:id', updateFeedback);
router.delete('/feedback/:id', deleteFeedback);

export default router;
