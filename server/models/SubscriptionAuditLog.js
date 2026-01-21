import mongoose from 'mongoose';

/**
 * Subscription Audit Log
 * 
 * Stores a complete history of all subscription changes for legal/audit purposes.
 * Each entry captures the full state before and after any subscription modification.
 */
const subscriptionAuditLogSchema = new mongoose.Schema({
  // User identification
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  userEmail: { type: String, required: true },
  userSnapId: { type: String, required: true },
  
  // Action type
  action: { 
    type: String, 
    enum: [
      'created',      // New subscription (webhook: subscription_created)
      'updated',      // Subscription modified (webhook: subscription_updated)
      'cancelled',    // User cancelled (webhook or manual)
      'expired',      // Subscription expired
      'resumed',      // Subscription resumed after pause
      'paused',       // Subscription paused
      'deleted',      // Admin permanently deleted
      'overridden',   // Admin manually changed tier/status
      'synced'        // Admin synced with LemonSqueezy
    ],
    required: true,
    index: true
  },
  
  // Source of the action
  source: {
    type: String,
    enum: ['webhook', 'admin', 'system', 'user'],
    default: 'system'
  },
  
  // Who performed the action (for admin actions)
  performedBy: {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminSnapId: { type: String },
    adminEmail: { type: String }
  },
  
  // Reason provided (required for admin actions)
  reason: { type: String },
  
  // Snapshot of subscription data BEFORE the action
  previousData: {
    tier: String,
    status: String,
    subscriptionId: String,
    customerId: String,
    variantId: String,
    productId: String,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    billingCycle: String,
    customerPortalUrl: String,
    cancelledAt: Date
  },
  
  // Snapshot AFTER the action
  newData: {
    tier: String,
    status: String,
    subscriptionId: String,
    customerId: String,
    variantId: String,
    productId: String,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    billingCycle: String,
    customerPortalUrl: String,
    cancelledAt: Date
  },
  
  // LemonSqueezy event data (for webhook actions)
  webhookEvent: {
    eventName: String,
    eventId: String
  },
  
  // Metadata
  ipAddress: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now }
}, { 
  timestamps: false,
  collection: 'subscriptionauditlogs'
});

// Compound indexes for efficient queries
subscriptionAuditLogSchema.index({ userId: 1, createdAt: -1 });
subscriptionAuditLogSchema.index({ 'performedBy.adminId': 1, createdAt: -1 });
subscriptionAuditLogSchema.index({ action: 1, createdAt: -1 });
subscriptionAuditLogSchema.index({ source: 1, createdAt: -1 });
subscriptionAuditLogSchema.index({ createdAt: -1 }); // General sorting index
subscriptionAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 730 * 24 * 60 * 60 }); // Retention: 2 years

export default mongoose.model('SubscriptionAuditLog', subscriptionAuditLogSchema);
