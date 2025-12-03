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
    respondToAppeal
} from '../controllers/adminController.js';
import { getAllLinks, updateLinkStatus, deleteLinkAdmin } from '../controllers/adminLinkController.js';

const router = express.Router();

// Security: IP Whitelist -> Auth -> Admin Role
router.use(ipWhitelist, verifyToken, verifyAdmin);

// Stats
router.get('/stats', getSystemStats);

// Settings
router.get('/settings', getSettings);
router.patch('/settings', updateSettings);
router.post('/settings/test-email', testEmailConfiguration);

// Cache Management
router.post('/cache/clear', clearUrlCache);

// User Management
router.get('/users', getAllUsers);
router.post('/users', createUser);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);
router.get('/users/:id/ban-history', getUserBanHistory);
router.get('/users/:id/appeals', getUserAppeals);

// Appeal Management
router.get('/appeals', getAllAppeals);
router.patch('/appeals/:id', respondToAppeal);

// Link Management
router.get('/links', getAllLinks);
router.patch('/links/:id/status', updateLinkStatus);
router.delete('/links/:id', deleteLinkAdmin);

export default router;
