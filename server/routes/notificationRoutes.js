import express from 'express';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { adminNotificationLimiter, adminNotificationWriteLimiter } from '../middleware/rateLimiter.js';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  createTestNotification
} from '../controllers/notificationController.js';

const router = express.Router();

// Rate limiting must be applied before other middleware to protect all routes
router.use(adminNotificationLimiter);

// All routes require admin authentication
router.use(protect);
router.use(adminOnly);

// GET /api/admin/notifications - Get all notifications
router.get('/', getNotifications);

// GET /api/admin/notifications/count - Get unread count (for polling)
router.get('/count', getUnreadCount);

// Write operations get stricter rate limit
router.use(adminNotificationWriteLimiter);

// PATCH /api/admin/notifications/read - Mark specific notifications as read
router.patch('/read', markAsRead);

// PATCH /api/admin/notifications/read-all - Mark all as read
router.patch('/read-all', markAllAsRead);

// POST /api/admin/notifications/test - Create test notification (dev only)
router.post('/test', createTestNotification);

export default router;
