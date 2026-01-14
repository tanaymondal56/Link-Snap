import User from '../models/User.js';
import { TIERS, getEffectiveTier } from '../services/subscriptionService.js';
import logger from '../utils/logger.js';
import AnonUsage from '../models/AnonUsage.js';
import { getAnonFingerprint } from '../utils/fingerprint.js';

/**
 * Middleware to check if user has reached their monthly link creation limit
 */
export const checkLinkLimit = async (req, res, next) => {
  try {
    const user = req.user;

    // 1. Anonymous Check
    if (!user) {
        const fingerprint = getAnonFingerprint(req);
        const usage = await AnonUsage.findOne({ fingerprint });
        if (usage && usage.createdCount >= 10) {
             return res.status(403).json({
                 type: 'anon_limit',
                 message: "You've used all 10 guest links! Create a free account to keep shortening.",
                 action: 'signup'
             });
        }
        return next();
    }
    
    // 2. Logged-in User Check (Admins bypass)
    if (user.role === 'admin') return next();
    
    const tier = getEffectiveTier(user);
    const config = TIERS[tier];
    
    // Get Limits (Hard vs Active)
    const hardLimit = config ? config.linksPerMonth : 100; // Monthly creation limit
    const activeLimit = config ? config.activeLimit : 25;  // Concurrent active links
    
    const currentPeriodStart = user.subscription?.currentPeriodStart;
    const resetAt = user.linkUsage?.resetAt;
    
    // RESET LOGIC: Only reset Hard Count (total created this period)
    // Active Count assumes concurrent links, never resets based on time
    let shouldReset = false;
    const now = new Date();
    
    if (currentPeriodStart) {
        // For subs, reset if usage.resetAt is before current period start
        if (resetAt && new Date(resetAt) < new Date(currentPeriodStart)) {
            shouldReset = true;
        }
    } else {
        // For free tier, reset monthly
        const lastReset = resetAt ? new Date(resetAt) : new Date(0);
        const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);
        if (daysSinceReset >= 30) {
            shouldReset = true;
        }
    }
    
    if (shouldReset) {
         await User.findByIdAndUpdate(user._id, {
            $set: {
                'linkUsage.hardCount': 0, // Reset ONLY hard count
                'linkUsage.resetAt': now
            }
         });
         // Update local user object
         if (!user.linkUsage) user.linkUsage = {};
         user.linkUsage.hardCount = 0;
         user.linkUsage.resetAt = now;
    }
    
    const currentHard = user.linkUsage?.hardCount || 0;
    const currentActive = user.linkUsage?.count || 0;
    
    // CHECK HARD LIMIT (Total created)
    if (currentHard >= hardLimit) {
        if (tier === 'business' && currentHard < hardLimit * 1.2) {
            logger.warn(`[Soft Cap] Business User ${user.snapId || user._id} exceeded hard limit: ${currentHard}/${hardLimit}`);
            return next();
        }
        
        return res.status(403).json({ 
            type: 'hard_limit',
            message: `You've hit your monthly cap of ${hardLimit} links. Upgrade to Pro for more capacity!`,
            limit: hardLimit,
            current: currentHard,
            resetsAt: currentPeriodStart || new Date(now.getTime() + 30*24*60*60*1000), // Approx
            tier: tier
        });
    }

    // CHECK ACTIVE LIMIT (Concurrent)
    if (activeLimit !== Infinity && currentActive >= activeLimit) {
        return res.status(403).json({ 
            type: 'active_limit',
            message: `Your account is full (${activeLimit} active links). Delete some old links to make space.`,
            limit: activeLimit,
            current: currentActive,
            tier: tier,
            action: 'manage'
        });
    }
    
    next();
  } catch (error) {
    logger.error(`[Limit Check Error] ${error.message}`);
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
// Helper to increment usage (call this AFTER successful creation)
// Accepts whole req object to handle Anon users, or just userId for legacy calls (conditional)
export const incrementLinkUsage = async (reqOrUserId) => {
    // Check if it's a request object (has .user or .ip)
    if (typeof reqOrUserId === 'object' && (reqOrUserId.user || reqOrUserId.ip || reqOrUserId.headers)) {
        const req = reqOrUserId;
        if (!req.user) {
            // Anon Increment
            const fingerprint = getAnonFingerprint(req);
            await AnonUsage.findOneAndUpdate(
                { fingerprint },
                { 
                    $inc: { createdCount: 1 }, 
                    $setOnInsert: { expiresAt: new Date(Date.now() + 30*24*60*60*1000) } // 30 day TTL
                },
                { upsert: true }
            );
        } else {
            // User Increment
            await User.findByIdAndUpdate(req.user._id, { 
                $inc: { 
                    'linkUsage.count': 1,      // Active count +1
                    'linkUsage.hardCount': 1   // Hard count +1
                } 
            });
        }
    } else {
        // Legacy: Just userId passed (assume logged in user)
        await User.findByIdAndUpdate(reqOrUserId, { 
            $inc: { 'linkUsage.count': 1, 'linkUsage.hardCount': 1 } 
        });
    }
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
