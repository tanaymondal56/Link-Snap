import User from '../models/User.js';
import { TIERS, getEffectiveTier } from '../services/subscriptionService.js';
import logger from '../utils/logger.js';

/**
 * Middleware to check if user has reached their monthly link creation limit
 */
export const checkLinkLimit = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return next();
    
    // Admins bypass limits
    if (user.role === 'admin') return next();
    
    const tier = getEffectiveTier(user);
    const config = TIERS[tier];
    
    // Safety check - if config missing (shouldn't happen), assume free
    const limit = config ? config.linksPerMonth : TIERS.free.linksPerMonth;
    
    const currentPeriodStart = user.subscription?.currentPeriodStart;
    const resetAt = user.linkUsage?.resetAt;
    
    // RESET LOGIC: Check if we need to reset the counter
    // If we have a subscription period, sync with it.
    // Otherwise (Free tier), reset monthly from last reset.
    let shouldReset = false;
    const now = new Date();
    
    if (currentPeriodStart) {
        // For subs, reset if usage.resetAt is before current period start
        if (resetAt && new Date(resetAt) < new Date(currentPeriodStart)) {
            shouldReset = true;
        }
    } else {
        // For free tier, reset every 30 days
        const lastReset = resetAt ? new Date(resetAt) : new Date(0);
        const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);
        if (daysSinceReset >= 30) {
            shouldReset = true;
        }
    }
    
    if (shouldReset) {
         // Atomic reset
         await User.findByIdAndUpdate(user._id, {
            $set: {
                'linkUsage.count': 0,
                'linkUsage.resetAt': now
            }
         });
         // Update local user object so we don't block this request
         if (!user.linkUsage) user.linkUsage = {};
         user.linkUsage.count = 0;
         user.linkUsage.resetAt = now;
    }
    
    // Ensure linkUsage exists before checking
    const currentCount = user.linkUsage?.count || 0;
    
    // CHECK LIMIT
    if (currentCount >= limit) {
        // Business Tier Soft Cap Logic (120% allowance + Logging)
        if (tier === 'business' && currentCount < limit * 1.2) {
            logger.warn(`[Soft Cap] Business User ${user.snapId || user._id} exceeded link limit: ${currentCount}/${limit}`);
            // Allow proceed
            return next();
        }
        
        return res.status(403).json({ 
            message: `Monthly link limit reached (${limit}). Upgrade to increase limits.`,
            limit: limit,
            tier: tier
        });
    }
    
    next();
  } catch (error) {
    logger.error(`[Limit Check Error] ${error.message}`);
    // Fail open or closed? Closed is safer to prevent abuse.
    next(error); 
  }
};

/**
 * Middleware to check if user has access to a specific premium feature
 */
export const checkFeature = (featureKeys) => {
  return (req, res, next) => {
      // Logic would go here if we had backend feature flags per route
      // For now, most feature logic is in the UI or implied by the tier.
      // But we can verify "custom_alias" is allowed for the user here.
      
      const user = req.user;
      if (!user) return res.status(401).json({ message: 'Unauthorized' });
      if (user.role === 'admin') return next();

      const tier = getEffectiveTier(user);
      const allowedFeatures = TIERS[tier]?.features || [];
      
      // If featureKeys is string, wrap in array
      const keys = Array.isArray(featureKeys) ? featureKeys : [featureKeys];
      
      const hasAccess = keys.every(k => allowedFeatures.includes(k));
      
      if (!hasAccess) {
          return res.status(403).json({ 
              message: `This feature requires the ${TIERS.pro.name} plan.`,
              upgradeRequired: true
          });
      }
      
      next();
  };
};

// Helper to increment usage (call this AFTER successful creation)
export const incrementLinkUsage = async (userId) => {
    await User.findByIdAndUpdate(userId, { 
        $inc: { 'linkUsage.count': 1 } 
    });
};

/**
 * Check and increment click usage (Atomic)
 * Returns { allowed: boolean, limit: number, usage: number }
 */
export const checkAndIncrementClickUsage = async (userId) => {
  const user = await User.findById(userId).select('subscription clickUsage role snapId');
  if (!user) return { allowed: true }; // Should not happen, but fail open
  
  if (user.role === 'admin') return { allowed: true };
  
  const tier = getEffectiveTier(user);
  const config = TIERS[tier];
  const limit = config ? config.clicksPerMonth : TIERS.free.clicksPerMonth;
  
  // Reset Logic (Same as link usage)
  const currentPeriodStart = user.subscription?.currentPeriodStart;
  const resetAt = user.clickUsage?.resetAt;
  let shouldReset = false;
  const now = new Date();
  
  if (currentPeriodStart) {
      if (resetAt && new Date(resetAt) < new Date(currentPeriodStart)) shouldReset = true;
  } else {
      const lastReset = resetAt ? new Date(resetAt) : new Date(0);
      if ((now - lastReset) / (1000 * 60 * 60 * 24) >= 30) shouldReset = true;
  }
  
  if (shouldReset) {
       await User.findByIdAndUpdate(user._id, {
          $set: { 'clickUsage.count': 0, 'clickUsage.resetAt': now }
       });
       user.clickUsage.count = 0;
  }
  
  // Soft Cap for Business (Allow up to 120%)
  const effectiveLimit = tier === 'business' ? Math.floor(limit * 1.2) : limit;

  if (user.clickUsage.count >= effectiveLimit) {
      if (tier === 'business') logger.warn(`[Soft Cap] Business User ${user.snapId} click hard limit reached: ${effectiveLimit}`);
      return { allowed: false, limit: effectiveLimit, usage: user.clickUsage.count };
  }
  
  // Atomic Increment
  // We use findOneAndUpdate to ensure we don't cross the limit in race conditions
  // But for clicks, slight overage is fine for performance. Simple $inc is faster.
  // Using simple findByIdAndUpdate without condition for speed, since we already checked count.
  // (Race condition might allow a few extra clicks, which is acceptable).
  await User.findByIdAndUpdate(user._id, { $inc: { 'clickUsage.count': 1 } });
  
  return { allowed: true };
};
