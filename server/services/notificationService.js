import AdminNotification from '../models/AdminNotification.js';

/**
 * Admin Notification Service
 * Provides helper methods to trigger notifications with proper aggregation
 */
class NotificationService {

  // ==================== CRITICAL (Real-time) ====================

  static async paymentFailed(userId, userEmail, amount, error) {
    return AdminNotification.createOrAggregate(
      'payment_failed',
      'critical',
      '💳 Payment Failed',
      `Payment of $${amount} failed for ${userEmail}: ${error}`,
      { userId, userEmail, amount, error }
    );
  }

  static async webhookError(eventType, error, webhookId) {
    return AdminNotification.createOrAggregate(
      'webhook_error',
      'critical',
      '🔗 Webhook Error',
      `Webhook ${eventType} failed: ${error}`,
      { eventType, error, webhookId }
    );
  }

  static async securityAlert(type, details, ipAddress) {
    return AdminNotification.createOrAggregate(
      'security_alert',
      'critical',
      '🚨 Security Alert',
      `${type}: ${details}`,
      { type, details, ipAddress }
    );
  }

  static async systemError(component, error) {
    return AdminNotification.createOrAggregate(
      'system_error',
      'critical',
      '⚠️ System Error',
      `${component}: ${error}`,
      { component, error }
    );
  }

  // ==================== WARNING (Immediate) ====================

  static async suspiciousActivity(action, userId, ipAddress, details) {
    return AdminNotification.createOrAggregate(
      'suspicious_activity',
      'warning',
      '👁️ Suspicious Activity',
      `${action} detected from ${ipAddress}: ${details}`,
      { action, userId, ipAddress, details }
    );
  }

  static async rateLimitExceeded(endpoint, ipAddress, requestCount) {
    return AdminNotification.createOrAggregate(
      'rate_limit_exceeded',
      'warning',
      '🚦 Rate Limit Exceeded',
      `${requestCount} requests to ${endpoint} from ${ipAddress}`,
      { endpoint, ipAddress, requestCount }
    );
  }

  static async subscriptionCancelled(userId, userEmail, tier, reason) {
    return AdminNotification.createOrAggregate(
      'subscription_cancelled',
      'warning',
      '📉 Subscription Cancelled',
      `${userEmail} cancelled ${tier} plan: ${reason || 'No reason provided'}`,
      { userId, userEmail, tier, reason }
    );
  }

  // ==================== INFO (Aggregated hourly) ====================

  static async userSignup(userId, userEmail) {
    return AdminNotification.createOrAggregate(
      'user_signup',
      'info',
      '👤 New User Signups',
      '{count} new user(s) signed up this hour',
      { latestUser: { userId, userEmail } }
    );
  }

  static async linkCreated(userId, linkId, shortCode) {
    return AdminNotification.createOrAggregate(
      'link_created',
      'info',
      '🔗 Links Created',
      '{count} link(s) created this hour',
      { latestLink: { userId, linkId, shortCode } }
    );
  }

  static async subscriptionCreated(userId, userEmail, tier) {
    return AdminNotification.createOrAggregate(
      'subscription_created',
      'info',
      '💎 New Subscriptions',
      '{count} new subscription(s) this hour',
      { latestSubscription: { userId, userEmail, tier } }
    );
  }

  // ==================== SUMMARY (Manual/Scheduled) ====================

  static async dailySummary(stats) {
    return AdminNotification.create({
      type: 'daily_summary',
      severity: 'summary',
      title: '📊 Daily Summary',
      message: `Today: ${stats.newUsers} users, ${stats.newLinks} links, ${stats.revenue} revenue`,
      metadata: stats,
      aggregationKey: `daily-${new Date().toISOString().split('T')[0]}`
    });
  }

  // ==================== UTILITY METHODS ====================

  static async getNotifications(options = {}) {
    const {
      severity = null,
      isRead = null,
      limit = 20,
      skip = 0
    } = options;

    const query = {};
    if (severity) query.severity = severity;
    if (isRead !== null) query.isRead = isRead;

    return AdminNotification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  static async markAsRead(notificationIds) {
    return AdminNotification.updateMany(
      { _id: { $in: notificationIds } },
      { $set: { isRead: true } }
    );
  }

  static async markAllAsRead() {
    return AdminNotification.updateMany(
      { isRead: false },
      { $set: { isRead: true } }
    );
  }

  static async getUnreadCount() {
    return AdminNotification.countDocuments({ isRead: false });
  }

  static async getUnreadCountBySeverity() {
    return AdminNotification.getUnreadCounts();
  }

  static async deleteOldNotifications(daysOld = 30) {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    return AdminNotification.deleteMany({ createdAt: { $lt: cutoff } });
  }
}

export default NotificationService;
