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

// ... (existing routes)

// Feedback Management
router.get('/feedback/export', exportFeedbackCSV);
router.get('/feedback', getAllFeedback);
router.get('/feedback/stats', getFeedbackStats);
router.patch('/feedback/:id', updateFeedback);
router.delete('/feedback/:id', deleteFeedback);

export default router;
