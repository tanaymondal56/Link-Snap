import mongoose from 'mongoose';
import logger from '../utils/logger.js';

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
    type: String
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
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }
});

// TTL index: Auto-expire notifications after 30 days
adminNotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Unique aggregation window: guarantees only one aggregated doc per
// type+hour so concurrent creators collide safely on 11000 instead of
// duplicating notifications. Sparse — critical/warning docs use null keys.
adminNotificationSchema.index({ aggregationKey: 1 }, { unique: true, sparse: true });

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
  const aggregationKey = `${type}-${hourStart.toISOString()}`;

  // ── Race-safe aggregation ─────────────────────────────────────────────
  // The previous read-modify-write (findOne → count += 1 → save) silently lost
  // increments under concurrent events. Strategy:
  //   1. FAST PATH — atomic pipeline update on the existing doc: count is
  //      incremented and the message re-rendered from the NEW count in one
  //      round-trip. No read-modify-write window.
  //   2. CREATE PATH — if no doc exists yet, insert it; a concurrent creator
  //      colliding on the unique aggregationKey index loses safely (11000)
  //      and subsequent events take the fast path.
  const updated = await this.findOneAndUpdate(
    { aggregationKey, type, title: { $exists: true } },
    [
      { $set: { __newCount: { $add: [{ $ifNull: ['$count', 0] }, 1] } } },
      {
        $set: {
          count: '$__newCount',
          message: {
            $replaceAll: {
              input: messageTemplate,
              find: '{count}',
              replacement: { $toString: '$__newCount' }
            }
          },
          isRead: false,
          aggregationEnd: now
        }
      },
      { $unset: '__newCount' }
    ],
    { returnDocument: 'after' }
  ).catch((err) => {
    logger.warn(`[AdminNotification] Fast-path aggregate failed (${err.message}); using create path.`);
    return null;
  });

  if (updated) return updated;

  try {
    return await this.create({
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
  } catch (err) {
    if (err.code === 11000) {
      // A concurrent creator inserted this window's doc first — read it back.
      return this.findOne({ aggregationKey, type });
    }
    throw err;
  }
};

const AdminNotification = mongoose.model('AdminNotification', adminNotificationSchema);

export default AdminNotification;
