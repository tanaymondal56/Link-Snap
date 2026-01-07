import User from '../models/User.js';
import SubscriptionAuditLog from '../models/SubscriptionAuditLog.js';
import logger from '../utils/logger.js';
import axios from 'axios';
import mongoose from 'mongoose';


/**
 * Get subscription statistics (Admin only)
 * GET /api/admin/subscriptions/stats
 */
export const getSubscriptionStats = async (req, res) => {
  try {
    // Cosmos DB doesn't fully support $facet, so use separate queries
    
    // Get tier counts
    const tierCounts = await User.aggregate([
      { $group: { _id: '$subscription.tier', count: { $sum: 1 } } }
    ]);
    
    // Get status counts
    const statusCounts = await User.aggregate([
      { $match: { 'subscription.status': { $exists: true } } },
      { $group: { _id: '$subscription.status', count: { $sum: 1 } } }
    ]);
    
    // Get recent upgrades (fetch without sort, sort in JS - Cosmos DB index workaround)
    let recentUpgrades = await User.find({
      'subscription.tier': { $in: ['pro', 'business'] },
      'subscription.currentPeriodStart': { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    })
      .limit(50) // Fetch more, sort in JS
      .select('email snapId subscription.tier subscription.currentPeriodStart createdAt');
    
    // Sort in JavaScript
    recentUpgrades = recentUpgrades
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);
    
    // Get total count
    const totalUsers = await User.countDocuments();
    
    // Format tier counts
    const byTier = { free: 0, pro: 0, business: 0 };
    tierCounts.forEach(t => {
      if (t._id) byTier[t._id] = t.count;
    });
    
    // Count users without explicit tier as free
    const usersWithTier = tierCounts.filter(t => t._id).reduce((sum, t) => sum + t.count, 0);
    byTier.free = totalUsers - usersWithTier + (byTier.free || 0);
    
    // Format status counts
    const byStatus = {};
    statusCounts.forEach(s => {
      if (s._id) byStatus[s._id] = s.count;
    });
    
    // Get permanent delete count from audit logs
    const permanentDeleteCount = await SubscriptionAuditLog.countDocuments({ action: 'deleted' });
    
    // Get audit action counts for overview
    const auditCounts = await SubscriptionAuditLog.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } }
    ]);
    const byAction = {};
    auditCounts.forEach(a => {
      if (a._id) byAction[a._id] = a.count;
    });
    
    res.json({
      byTier,
      byStatus,
      byAction,
      totalSubscribers: byTier.pro + byTier.business,
      permanentDeleteCount,
      recentUpgrades
    });
    
  } catch (error) {
    logger.error(`[Admin Subscription Stats Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to get subscription stats' });
  }
};

/**
 * Get subscription audit logs (Admin only)
 * GET /api/admin/subscriptions/audit-logs
 */
export const getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20)); // Cap at 50
    const skip = (page - 1) * limit;
    
    // Validate query parameters to prevent NoSQL injection
    const allowedActions = ['created', 'updated', 'resumed', 'cancelled', 'paused', 'expired', 'overridden', 'synced', 'deleted'];
    const allowedSources = ['webhook', 'admin', 'system', 'user'];
    
    const rawAction = req.query.action;
    const rawSource = req.query.source;
    
    const action = (typeof rawAction === 'string' && allowedActions.includes(rawAction.toLowerCase().trim()))
      ? rawAction.toLowerCase().trim()
      : null;
    const source = (typeof rawSource === 'string' && allowedSources.includes(rawSource.toLowerCase().trim()))
      ? rawSource.toLowerCase().trim()
      : null;
    
    // Build query (validated)
    const query = {};
    if (action && action !== 'all') {
      query.action = action;
    }
    if (source && source !== 'all') {
      query.source = source;
    }
    
    // Get total count
    const total = await SubscriptionAuditLog.countDocuments(query);
    
    // Fetch logs with pagination, sorted by newest first
    // Cosmos DB workaround: fetch enough to cover current page + buffer, sort in JS
    const fetchLimit = Math.min(skip + limit + 50, total + 50); // Fetch enough for current page
    let logs = await SubscriptionAuditLog.find(query)
      .limit(fetchLimit);
    
    // Sort in JavaScript (Cosmos DB index workaround)
    logs = logs
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(skip, skip + limit);
    
    res.json({
      logs,
      page,
      pages: Math.ceil(total / limit) || 1,
      total
    });
    
  } catch (error) {
    logger.error(`[Admin Audit Logs Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
};

/**
 * Override a user's subscription (Admin only)
 * PATCH /api/admin/users/:userId/subscription
 */
export const overrideUserSubscription = async (req, res) => {
  try {
    const { userId } = req.params;
    const { tier, status, durationDays, reason } = req.body;
    
    // Validate ObjectId format FIRST (before DB query)
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Validate tier
    if (tier && !['free', 'pro', 'business'].includes(tier)) {
      return res.status(400).json({ message: 'Invalid tier' });
    }
    
    // Validate status
    const validStatuses = ['active', 'on_trial', 'past_due', 'paused', 'cancelled', 'expired', 'unpaid'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // Store previous state for audit
    const previousData = {
      tier: user.subscription?.tier,
      status: user.subscription?.status,
      subscriptionId: user.subscription?.subscriptionId,
      customerId: user.subscription?.customerId,
      variantId: user.subscription?.variantId,
      currentPeriodStart: user.subscription?.currentPeriodStart,
      currentPeriodEnd: user.subscription?.currentPeriodEnd,
      billingCycle: user.subscription?.billingCycle,
      cancelledAt: user.subscription?.cancelledAt
    };
    
    // Calculate new period end
    const now = new Date();
    let periodEnd = null;
    if (durationDays) {
      periodEnd = new Date(now.getTime() + parseInt(durationDays) * 24 * 60 * 60 * 1000);
    }
    
    // Build update object
    const updateObj = {};
    if (tier) {
      updateObj['subscription.tier'] = tier;
      if (tier === 'free') {
        updateObj['subscription.status'] = 'active';
        updateObj['subscription.currentPeriodEnd'] = null;
        updateObj['subscription.billingCycle'] = null;
      }
    }
    if (status) updateObj['subscription.status'] = status;
    if (periodEnd) updateObj['subscription.currentPeriodEnd'] = periodEnd;
    updateObj['subscription.currentPeriodStart'] = now;
    updateObj['subscription.variantId'] = `ADMIN-OVERRIDE-${req.user.snapId}`;
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateObj },
      { new: true }
    ).select('email snapId subscription');
    
    // Create audit log for the override
    try {
      await SubscriptionAuditLog.create({
        userId: user._id,
        userEmail: user.email,
        userSnapId: user.snapId,
        action: 'overridden',
        source: 'admin',
        performedBy: {
          adminId: req.user._id,
          adminSnapId: req.user.snapId,
          adminEmail: req.user.email
        },
        reason: reason || 'Admin subscription override',
        previousData: previousData,
        newData: {
          tier: updatedUser.subscription?.tier,
          status: updatedUser.subscription?.status,
          subscriptionId: updatedUser.subscription?.subscriptionId,
          customerId: updatedUser.subscription?.customerId,
          variantId: updatedUser.subscription?.variantId,
          currentPeriodStart: updatedUser.subscription?.currentPeriodStart,
          currentPeriodEnd: updatedUser.subscription?.currentPeriodEnd,
          billingCycle: updatedUser.subscription?.billingCycle
        },
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.get('User-Agent')
      });
    } catch (auditErr) {
      logger.error(`[Admin Override Audit Error] ${auditErr.message}`);
    }
    
    logger.info(`[Admin Override] Admin ${req.user.snapId} changed ${user.snapId} subscription: tier=${tier}, status=${status}, days=${durationDays}. Reason: ${reason || 'N/A'}`);
    
    res.json({
      message: 'Subscription updated',
      user: updatedUser
    });
    
  } catch (error) {
    logger.error(`[Admin Subscription Override Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to update subscription' });
  }
};

/**
 * Sync user's subscription with Lemon Squeezy (Admin only)
 * POST /api/admin/users/:userId/subscription/sync
 */
export const syncUserSubscription = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user has a Lemon Squeezy subscription ID
    if (!user.subscription?.subscriptionId) {
      return res.status(400).json({ message: 'User has no linked Lemon Squeezy subscription' });
    }
    
    // Check if subscription was manually overridden by admin (not synced with LS)
    const subscriptionId = user.subscription.subscriptionId;
    if (subscriptionId.startsWith('ADMIN-OVERRIDE')) {
      return res.status(400).json({ 
        message: 'This subscription was manually set by admin and cannot be synced with LemonSqueezy. Use "Permanently Delete" first if you need to reset it.' 
      });
    }
    
    // Store previous state for audit
    const previousData = {
      tier: user.subscription?.tier,
      status: user.subscription?.status,
      subscriptionId: user.subscription?.subscriptionId,
      customerId: user.subscription?.customerId,
      variantId: user.subscription?.variantId,
      currentPeriodStart: user.subscription?.currentPeriodStart,
      currentPeriodEnd: user.subscription?.currentPeriodEnd,
      billingCycle: user.subscription?.billingCycle,
      cancelledAt: user.subscription?.cancelledAt
    };
    
    try {
      const response = await axios.get(
        `https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`,
        {
          headers: {
            'Accept': 'application/vnd.api+json',
            'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`
          }
        }
      );
      
      const lsData = response.data.data.attributes;
      
      // Map variant to tier
      let tier = 'free';
      const variantId = lsData.variant_id?.toString();
      if (variantId === process.env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID || 
          variantId === process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID) {
        tier = 'pro';
      } else if (variantId === process.env.LEMONSQUEEZY_BUSINESS_MONTHLY_VARIANT_ID || 
                 variantId === process.env.LEMONSQUEEZY_BUSINESS_YEARLY_VARIANT_ID) {
        tier = 'business';
      }
      
      // Update user with fresh data
      const updatedUser = await User.findByIdAndUpdate(userId, {
        $set: {
          'subscription.status': lsData.status,
          'subscription.tier': tier,
          'subscription.currentPeriodStart': new Date(lsData.created_at),
          'subscription.currentPeriodEnd': new Date(lsData.renews_at || lsData.ends_at),
          'subscription.customerPortalUrl': lsData.urls?.customer_portal,
          'subscription.updatePaymentUrl': lsData.urls?.update_payment_method,
          'subscription.cancelledAt': lsData.cancelled ? new Date(lsData.cancelled_at) : null
        }
      }, { new: true }).select('email snapId subscription');
      
      // Create audit log for sync
      try {
        await SubscriptionAuditLog.create({
          userId: user._id,
          userEmail: user.email,
          userSnapId: user.snapId,
          action: 'synced',
          source: 'admin',
          performedBy: {
            adminId: req.user._id,
            adminSnapId: req.user.snapId,
            adminEmail: req.user.email
          },
          reason: 'Admin triggered sync with LemonSqueezy',
          previousData: previousData,
          newData: {
            tier: updatedUser.subscription?.tier,
            status: updatedUser.subscription?.status,
            subscriptionId: updatedUser.subscription?.subscriptionId,
            customerId: updatedUser.subscription?.customerId,
            variantId: updatedUser.subscription?.variantId,
            currentPeriodStart: updatedUser.subscription?.currentPeriodStart,
            currentPeriodEnd: updatedUser.subscription?.currentPeriodEnd,
            billingCycle: updatedUser.subscription?.billingCycle,
            cancelledAt: updatedUser.subscription?.cancelledAt
          },
          ipAddress: req.ip || req.headers['x-forwarded-for'],
          userAgent: req.get('User-Agent')
        });
      } catch (auditErr) {
        logger.error(`[Admin Sync Audit Error] ${auditErr.message}`);
      }
      
      logger.info(`[Admin Sync] Synced subscription for ${user.snapId} from Lemon Squeezy`);
      
      res.json({
        message: 'Subscription synced successfully',
        lemonSqueezyStatus: lsData.status,
        tier,
        user: updatedUser
      });
      
    } catch (lsError) {
      logger.error(`[Admin Sync LS Error] ${lsError.response?.data || lsError.message}`);
      return res.status(400).json({ 
        message: 'Failed to fetch from Lemon Squeezy. Subscription may not exist.',
        error: lsError.response?.data?.errors || lsError.message
      });
    }
    
  } catch (error) {
    logger.error(`[Admin Subscription Sync Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to sync subscription' });
  }
};

/**
 * Permanently delete a user's subscription (Admin only)
 * This wipes ALL subscription data and breaks the LemonSqueezy link.
 * DELETE /api/admin/users/:userId/subscription
 */
export const deleteUserSubscription = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, confirmationText } = req.body;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    // Require detailed reason for audit
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ 
        message: 'A detailed reason (minimum 10 characters) is required for audit purposes' 
      });
    }
    
    // Require confirmation text
    if (confirmationText !== 'DELETE') {
      return res.status(400).json({ message: 'Please type DELETE to confirm this action' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if there's anything to delete
    const hasSubscription = user.subscription?.subscriptionId || 
                           (user.subscription?.tier && user.subscription.tier !== 'free');
    
    if (!hasSubscription) {
      return res.status(400).json({ 
        message: 'User is already on Free tier with no linked subscription' 
      });
    }
    
    // Create audit log BEFORE wiping data
    let auditSuccess = true;
    try {
      await SubscriptionAuditLog.create({
        userId: user._id,
        userEmail: user.email,
        userSnapId: user.snapId,
        action: 'deleted',
        source: 'admin',
        performedBy: {
          adminId: req.user._id,
          adminSnapId: req.user.snapId,
          adminEmail: req.user.email
        },
        reason: reason.trim(),
        previousData: {
          tier: user.subscription?.tier,
          status: user.subscription?.status,
          subscriptionId: user.subscription?.subscriptionId,
          customerId: user.subscription?.customerId,
          variantId: user.subscription?.variantId,
          productId: user.subscription?.productId,
          currentPeriodStart: user.subscription?.currentPeriodStart,
          currentPeriodEnd: user.subscription?.currentPeriodEnd,
          billingCycle: user.subscription?.billingCycle,
          customerPortalUrl: user.subscription?.customerPortalUrl,
          cancelledAt: user.subscription?.cancelledAt
        },
        newData: {
          tier: 'free',
          status: 'active',
          subscriptionId: null,
          customerId: null,
          variantId: null,
          productId: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          billingCycle: null,
          customerPortalUrl: null,
          cancelledAt: null
        },
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.get('User-Agent')
      });
    } catch (auditErr) {
      // Log error but don't fail the delete operation
      logger.error(`[Admin Delete Audit Error] ${auditErr.message}`);
      auditSuccess = false;
    }
    
    // Wipe ALL subscription fields
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'subscription.tier': 'free',
          'subscription.status': 'active',
          'subscription.subscriptionId': null,
          'subscription.customerId': null,
          'subscription.variantId': null,
          'subscription.productId': null,
          'subscription.currentPeriodStart': null,
          'subscription.currentPeriodEnd': null,
          'subscription.billingCycle': null,
          'subscription.customerPortalUrl': null,
          'subscription.updatePaymentUrl': null,
          'subscription.cancelledAt': null
        }
      },
      { new: true }
    ).select('email snapId subscription');
    
    logger.warn(`[SUBSCRIPTION DELETED] Admin ${req.user.snapId} permanently deleted subscription for user ${user.snapId} (${user.email}). Previous tier: ${user.subscription?.tier}. Reason: ${reason.trim()}`);
    
    res.json({
      message: auditSuccess 
        ? 'Subscription permanently deleted and logged for audit'
        : 'Subscription permanently deleted (audit log failed)',
      user: updatedUser,
      auditLogged: auditSuccess
    });
    
  } catch (error) {
    logger.error(`[Admin Delete Subscription Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to delete subscription' });
  }
};
