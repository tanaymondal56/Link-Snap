import NotificationService from '../services/notificationService.js';
import logger from '../utils/logger.js';

/**
 * Get notifications for admin panel
 * GET /api/admin/notifications
 */
export const getNotifications = async (req, res) => {
  try {
    const { severity, limit = 20, skip = 0 } = req.query;

    const notifications = await NotificationService.getNotifications({
      severity: severity || null,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    const unreadCounts = await NotificationService.getUnreadCountBySeverity();
    const totalUnread = await NotificationService.getUnreadCount();

    res.json({
      notifications,
      unreadCounts,
      totalUnread
    });
  } catch (error) {
    logger.error(`[Notifications] Error fetching: ${error.message}`);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

/**
 * Mark notifications as read
 * PATCH /api/admin/notifications/read
 */
export const markAsRead = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: 'ids array is required' });
    }

    await NotificationService.markAsRead(ids);
    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    logger.error(`[Notifications] Error marking read: ${error.message}`);
    res.status(500).json({ message: 'Failed to mark notifications as read' });
  }
};

/**
 * Mark all notifications as read
 * PATCH /api/admin/notifications/read-all
 */
export const markAllAsRead = async (req, res) => {
  try {
    await NotificationService.markAllAsRead();
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    logger.error(`[Notifications] Error marking all read: ${error.message}`);
    res.status(500).json({ message: 'Failed to mark all as read' });
  }
};

/**
 * Get unread count only (lightweight endpoint for polling)
 * GET /api/admin/notifications/count
 */
export const getUnreadCount = async (req, res) => {
  try {
    const unreadCounts = await NotificationService.getUnreadCountBySeverity();
    const totalUnread = await NotificationService.getUnreadCount();

    res.json({
      total: totalUnread,
      ...unreadCounts
    });
  } catch (error) {
    logger.error(`[Notifications] Error fetching count: ${error.message}`);
    res.status(500).json({ message: 'Failed to fetch count' });
  }
};

/**
 * Test endpoint to create sample notifications (dev only)
 * POST /api/admin/notifications/test
 */
export const createTestNotification = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ message: 'Not available in production' });
    }

    const { type } = req.body;

    switch (type) {
      case 'signup':
        await NotificationService.userSignup('test-id', 'test@example.com');
        break;
      case 'link':
        await NotificationService.linkCreated('test-id', 'link-123', 'abc123');
        break;
      case 'payment_failed':
        await NotificationService.paymentFailed('test-id', 'test@example.com', '9.99', 'Card declined');
        break;
      case 'security':
        await NotificationService.securityAlert('Brute Force', 'Multiple failed login attempts', '192.168.1.1');
        break;
      default:
        await NotificationService.userSignup('test-id', 'test@example.com');
    }

    res.json({ message: 'Test notification created' });
  } catch (error) {
    logger.error(`[Notifications] Error creating test: ${error.message}`);
    res.status(500).json({ message: 'Failed to create test notification' });
  }
};
