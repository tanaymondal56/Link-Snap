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
    exportFeedbackCSV,
    getUsernameHistory,
    triggerSafetyScan
} from '../controllers/adminController.js';
import { getAllLinks, updateLinkStatus, deleteLinkAdmin, overrideLinkSafety, rescanLinkSafety } from '../controllers/adminLinkController.js';
import { 
    generateRedeemCode, 
    listRedeemCodes, 
    deactivateRedeemCode, 
    updateRedeemCode,
    getRedeemCodeStats 
} from '../controllers/redeemCodeController.js';
import { 
    getSubscriptionStats,
    getAuditLogs,
    overrideUserSubscription,
    syncUserSubscription,
    deleteUserSubscription
} from '../controllers/adminSubscriptionController.js';

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
router.get('/users/:userId/username-history', getUsernameHistory);

// Link Management
router.get('/links', getAllLinks);
router.patch('/links/:linkId/status', updateLinkStatus);
router.patch('/links/:linkId/safety', overrideLinkSafety);  // Safety override
router.post('/links/:linkId/rescan', rescanLinkSafety);     // Re-scan single link
router.delete('/links/:linkId', deleteLinkAdmin);

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.patch('/settings', updateSettings);  // Support partial updates
router.post('/settings/test-email', testEmailConfiguration);
router.post('/settings/scan', triggerSafetyScan);

// Cache
router.post('/cache/clear', clearUrlCache);

// Appeals
router.get('/appeals', getAllAppeals);
router.patch('/appeals/:appealId', respondToAppeal);

// Feedback Management
router.get('/feedback/export', exportFeedbackCSV);
router.get('/feedback', getAllFeedback);
router.get('/feedback/stats', getFeedbackStats);
router.patch('/feedback/:id', updateFeedback);
router.delete('/feedback/:id', deleteFeedback);

// Redeem Codes Management
router.get('/redeem-codes/stats', getRedeemCodeStats);
router.get('/redeem-codes', listRedeemCodes);
router.post('/redeem-codes', generateRedeemCode);
router.put('/redeem-codes/:id', updateRedeemCode);
router.delete('/redeem-codes/:id', deactivateRedeemCode);

// Subscription Management
router.get('/subscriptions/stats', getSubscriptionStats);
router.get('/subscriptions/audit-logs', getAuditLogs);
router.patch('/users/:userId/subscription', overrideUserSubscription);
router.post('/users/:userId/subscription/sync', syncUserSubscription);
router.delete('/users/:userId/subscription', deleteUserSubscription);

export default router;
