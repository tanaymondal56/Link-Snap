import mongoose from 'mongoose';

/**
 * Admin Notification Model
 * Stores aggregated notifications for admin dashboard
 * Uses severity-based filtering and time-based batching to prevent flooding
 */
const adminNotificationSchema = new mongoose.Schema({
  // Notification type for grouping
  type: {
    type: String,
    required: true,
    enum: [
      // Critical (real-time)
      'payment_failed',
      'webhook_error',
      'security_alert',
      'system_error',
      
      // Warning (immediate)
      'suspicious_activity',
      'rate_limit_exceeded',
      'subscription_cancelled',
      
      // Info (aggregated)
      'user_signup',
      'link_created',
      'subscription_created',
      
      // Summary (daily digest)
      'daily_summary'
    ],
    index: true
  },

  // Severity level for filtering
  severity: {
    type: String,
    required: true,
    enum: ['critical', 'warning', 'info', 'summary'],
    default: 'info',
    index: true
  },

  // Title and message
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  
  message: {
    type: String,
    required: true,
    maxlength: 500
  },

  // Aggregation count (e.g., "5 new users" = count: 5)
  count: {
    type: Number,
    default: 1
  },

  // Related data for drill-down
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Read status
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },

  // For aggregation - time window this notification covers
  aggregationKey: {
    type: String,
    index: true
  },
  
  aggregationStart: {
    type: Date
  },
  
  aggregationEnd: {
    type: Date
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Auto-expire after 30 days
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    index: { expireAfterSeconds: 0 }
  }
});

// Compound index for efficient queries
adminNotificationSchema.index({ severity: 1, isRead: 1, createdAt: -1 });
adminNotificationSchema.index({ type: 1, createdAt: -1 });

// Static method to get unread count by severity
adminNotificationSchema.statics.getUnreadCounts = async function() {
  const counts = await this.aggregate([
    { $match: { isRead: false } },
    { $group: { _id: '$severity', count: { $sum: 1 } } }
  ]);
  
  return counts.reduce((acc, { _id, count }) => {
    acc[_id] = count;
    return acc;
  }, { critical: 0, warning: 0, info: 0, summary: 0 });
};

// Static method to create or update aggregated notification
adminNotificationSchema.statics.createOrAggregate = async function(type, severity, title, messageTemplate, metadata = {}) {
  // For critical/warning, always create new notification
  if (severity === 'critical' || severity === 'warning') {
    return this.create({
      type,
      severity,
      title,
      message: messageTemplate,
      metadata,
      aggregationKey: null
    });
  }

  // For info/summary, aggregate within 1-hour windows
  const now = new Date();
  const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
  const aggregationKey = `${type}-${hourStart.toISOString()}`;

  // Try to find existing aggregated notification
  const existing = await this.findOne({
    aggregationKey,
    type,
    createdAt: { $gte: hourStart, $lt: hourEnd }
  });

  if (existing) {
    // Update count and message
    existing.count += 1;
    existing.message = messageTemplate.replace('{count}', existing.count);
    existing.aggregationEnd = now;
    existing.isRead = false; // Mark as unread again
    return existing.save();
  }

  // Create new aggregated notification
  return this.create({
    type,
    severity,
    title,
    message: messageTemplate.replace('{count}', '1'),
    count: 1,
    metadata,
    aggregationKey,
    aggregationStart: hourStart,
    aggregationEnd: now
  });
};

const AdminNotification = mongoose.model('AdminNotification', adminNotificationSchema);

export default AdminNotification;
