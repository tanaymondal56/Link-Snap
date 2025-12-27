import User from '../models/User.js';
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
    
    // Get recent upgrades (use find instead of aggregate to avoid nested field sort issues)
    const recentUpgrades = await User.find({
      'subscription.tier': { $in: ['pro', 'business'] },
      'subscription.currentPeriodStart': { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    })
      .sort({ createdAt: -1 }) // Sort by createdAt instead of nested field
      .limit(10)
      .select('email snapId subscription.tier subscription.currentPeriodStart');
    
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
    
    res.json({
      byTier,
      byStatus,
      totalSubscribers: byTier.pro + byTier.business,
      recentUpgrades
    });
    
  } catch (error) {
    logger.error(`[Admin Subscription Stats Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to get subscription stats' });
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
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user has a Lemon Squeezy subscription ID
    if (!user.subscription?.subscriptionId) {
      return res.status(400).json({ message: 'User has no linked Lemon Squeezy subscription' });
    }
    
    // Fetch subscription from Lemon Squeezy API
    const subscriptionId = user.subscription.subscriptionId;
    
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
      await User.findByIdAndUpdate(userId, {
        $set: {
          'subscription.status': lsData.status,
          'subscription.tier': tier,
          'subscription.currentPeriodStart': new Date(lsData.created_at),
          'subscription.currentPeriodEnd': new Date(lsData.renews_at || lsData.ends_at),
          'subscription.customerPortalUrl': lsData.urls?.customer_portal,
          'subscription.updatePaymentUrl': lsData.urls?.update_payment_method,
          'subscription.cancelledAt': lsData.cancelled ? new Date(lsData.cancelled_at) : null
        }
      });
      
      logger.info(`[Admin Sync] Synced subscription for ${user.snapId} from Lemon Squeezy`);
      
      res.json({
        message: 'Subscription synced successfully',
        lemonSqueezyStatus: lsData.status,
        tier
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
