import User from '../models/User.js';
import { TIERS, FEATURE_METADATA, getEffectiveTier } from '../services/subscriptionService.js';
import logger from '../utils/logger.js';
import AnonUsage from '../models/AnonUsage.js';
import { getAnonFingerprint } from '../utils/fingerprint.js';
import { queueUserClickIncrement } from '../services/clickStatsService.js';
import { LRUCache } from 'lru-cache';

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
        // Uses atomic conditional update to prevent race conditions (Cosmos DB compatible)
        const now = new Date();
        let resetPerformed = false;

        if (currentPeriodStart) {
            // For paid subs, reset if usage.resetAt is before current billing period start
            if (resetAt && new Date(resetAt) < new Date(currentPeriodStart)) {
                // ATOMIC: Only reset if resetAt still matches (prevents race condition)
                const resetResult = await User.findOneAndUpdate(
                    {
                        _id: user._id,
                        'linkUsage.resetAt': resetAt  // Conditional: only if unchanged
                    },
                    {
                        $set: {
                            'linkUsage.hardCount': 0,
                            'linkUsage.resetAt': now
                        }
                    },
                    { new: true }
                );
                resetPerformed = !!resetResult;
            }
        } else {
            // For free tier: reset on the 1st of each calendar month (not rolling 30 days)
            // This matches what the UI tooltip says: "Resets on the 1st of each month"
            const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const needsReset = !resetAt ||
                new Date(resetAt) < startOfCurrentMonth;

            if (needsReset) {
                const resetResult = await User.findOneAndUpdate(
                    {
                        _id: user._id,
                        $or: [
                            { 'linkUsage.resetAt': { $lt: startOfCurrentMonth } },
                            { 'linkUsage.resetAt': null },
                            { 'linkUsage.resetAt': { $exists: false } }
                        ]
                    },
                    {
                        $set: {
                            'linkUsage.hardCount': 0,
                            'linkUsage.resetAt': now
                        }
                    },
                    { new: true }
                );
                resetPerformed = !!resetResult;
            }
        }

        // Update local user object if reset was performed
        if (resetPerformed) {
            if (!user.linkUsage) user.linkUsage = {};
            user.linkUsage.hardCount = 0;
            user.linkUsage.resetAt = now;
        }

        const currentHard = user.linkUsage?.hardCount || 0;
        const currentActive = user.linkUsage?.count || 0;

        // CHECK HARD LIMIT (Total created)
        // Skip check entirely for unlimited tiers (Business)
        if (hardLimit !== Infinity && currentHard >= hardLimit) {
            return res.status(403).json({
                type: 'hard_limit',
                message: `You've hit your monthly cap of ${hardLimit} links. Upgrade to Pro for more capacity!`,
                limit: hardLimit,
                current: currentHard,
                resetsAt: currentPeriodStart || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
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
            // Find the minimum tier required for this feature using FEATURE_METADATA
            const requiredTierName = keys.reduce((name, key) => {
                const meta = FEATURE_METADATA[key];
                if (!meta) return name;
                // Prefer the higher tier name if multiple features are checked
                if (meta.tier === 'business') return TIERS.business.name;
                return name;
            }, TIERS.pro.name);

            return res.status(403).json({
                message: `This feature requires the ${requiredTierName} plan.`,
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
                    $setOnInsert: { expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } // 30 day TTL
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
 * Resolve the current (possibly reset) linkUsage for a user object.
 * Call this in getMe / refreshAccessToken so the dashboard always shows
 * the correct count even if the user hasn't tried to create a link yet.
 *
 * Returns the linkUsage object with hardCount already zeroed if a new
 * calendar month has started since the last reset.
 *
 * @param {object} user - Mongoose user document (or plain object with linkUsage & subscription)
 * @returns {object} linkUsage - { count, hardCount, resetAt } (potentially zeroed)
 */
export const resolveCurrentLinkUsage = async (user) => {
    const now = new Date();
    const linkUsage = user.linkUsage || { count: 0, hardCount: 0, resetAt: null };
    const resetAt = linkUsage.resetAt;
    const currentPeriodStart = user.subscription?.currentPeriodStart;

    let needsReset;

    if (currentPeriodStart) {
        // Paid sub: reset if last reset was before the current billing period start
        needsReset = resetAt && new Date(resetAt) < new Date(currentPeriodStart);
    } else {
        // Free tier: reset on the 1st of each calendar month
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        needsReset = !resetAt || new Date(resetAt) < startOfCurrentMonth;
    }

    if (!needsReset) {
        return linkUsage;
    }

    // Atomically reset — same logic as checkLinkLimit to stay in sync
    const condition = currentPeriodStart
        ? { _id: user._id, 'linkUsage.resetAt': resetAt }
        : {
            _id: user._id,
            $or: [
                { 'linkUsage.resetAt': { $lt: new Date(now.getFullYear(), now.getMonth(), 1) } },
                { 'linkUsage.resetAt': null },
                { 'linkUsage.resetAt': { $exists: false } }
            ]
        };

    const updated = await User.findOneAndUpdate(
        condition,
        { $set: { 'linkUsage.hardCount': 0, 'linkUsage.resetAt': now } },
        { new: true, select: 'linkUsage' }
    );

    if (updated) {
        return { ...linkUsage, hardCount: 0, resetAt: now };
    }

    // Another request beat us to the reset — return zeroed count anyway for this response
    return { ...linkUsage, hardCount: 0, resetAt: now };
};

/**
 * Check and increment click usage (Atomic)
 * Returns { allowed: boolean, limit: number, usage: number }
 */
// Local cache for user limits to avoid DB hits on every click
// Stores essential user data needed for limit checks (plain objects for memory efficiency)
const usageCache = new LRUCache({
    max: 2000,
    ttl: 1000 * 60, // 1 minute TTL (soft limit enforcement)
});

/**
 * Check and increment click usage (Optimized with Cache + Buffer)
 * Returns { allowed: boolean, limit: number, usage: number }
 */
export const checkAndIncrementClickUsage = async (userId) => {
    const userIdStr = userId.toString();

    // 1. Try Cache
    let user = usageCache.get(userIdStr);

    if (!user) {
        // Cache Miss: Fetch from DB
        const dbUser = await User.findById(userId).select('subscription clickUsage role snapId');
        if (!dbUser) return { allowed: true }; // Fail open

        // Store plain object in cache for memory efficiency
        user = {
            _id: dbUser._id,
            role: dbUser.role,
            snapId: dbUser.snapId,
            subscription: dbUser.subscription ? dbUser.subscription.toObject?.() || dbUser.subscription : null,
            clickUsage: dbUser.clickUsage ? { ...dbUser.clickUsage.toObject?.() || dbUser.clickUsage } : { count: 0, resetAt: null }
        };
        usageCache.set(userIdStr, user);
    }

    if (user.role === 'admin') return { allowed: true };

    const tier = getEffectiveTier(user);
    const config = TIERS[tier];
    const limit = config ? config.clicksPerMonth : TIERS.free.clicksPerMonth;

    // Reset Logic - Uses atomic conditional update (Cosmos DB compatible)
    const currentPeriodStart = user.subscription?.currentPeriodStart;
    const resetAt = user.clickUsage?.resetAt;
    let resetPerformed = false;
    const now = new Date();

    if (currentPeriodStart) {
        // For subs, reset if usage.resetAt is before current period start
        if (resetAt && new Date(resetAt) < new Date(currentPeriodStart)) {
            // ATOMIC: Only reset if resetAt still matches (prevents race condition)
            const resetResult = await User.findOneAndUpdate(
                {
                    _id: user._id,
                    'clickUsage.resetAt': resetAt  // Conditional: only if unchanged
                },
                {
                    $set: { 'clickUsage.count': 0, 'clickUsage.resetAt': now }
                },
                { new: true }
            );
            resetPerformed = !!resetResult;
        }
    } else {
        // For free tier, reset on the 1st of each calendar month (matches UI and link creation logic)
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const resetResult = await User.findOneAndUpdate(
            {
                _id: user._id,
                $or: [
                    { 'clickUsage.resetAt': { $lt: startOfCurrentMonth } },
                    { 'clickUsage.resetAt': null },
                    { 'clickUsage.resetAt': { $exists: false } }
                ]
            },
            {
                $set: { 'clickUsage.count': 0, 'clickUsage.resetAt': now }
            },
            { new: true }
        );
        resetPerformed = !!resetResult;
    }

    // Update cache if reset was performed
    if (resetPerformed) {
        if (!user.clickUsage) {
            user.clickUsage = { count: 0, resetAt: null };
        }
        user.clickUsage.count = 0;
        user.clickUsage.resetAt = now;
        usageCache.set(userIdStr, user);
    }

    // Soft Cap for Business (Allow up to 120%)
    // Fast path: if limit is Infinity (Business), immediately allow without math/checks
    if (limit === Infinity) {
        return { allowed: true };
    }
    const effectiveLimit = tier === 'business' ? Math.floor(limit * 1.2) : limit;

    // Defensive check for clickUsage existence
    const currentClickCount = user.clickUsage?.count ?? 0;

    if (currentClickCount >= effectiveLimit) {
        if (tier === 'business') logger.warn(`[Soft Cap] Business User ${user.snapId} click hard limit reached: ${effectiveLimit}`);
        return { allowed: false, limit: effectiveLimit, usage: currentClickCount };
    }

    // 2. Allowed: Increment Memory Cache (for strict local limiting)
    if (!user.clickUsage) {
        user.clickUsage = { count: 0, resetAt: null };
    }
    user.clickUsage.count += 1;

    // 3. Queue DB Increment (Buffered)
    queueUserClickIncrement(user._id);

    return { allowed: true };
};
