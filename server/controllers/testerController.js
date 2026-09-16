import User from '../models/User.js';
import { getEffectiveTier } from '../services/subscriptionService.js';
import { calculateSubscriptionEndDate } from '../utils/dateUtils.js';
import { redisGet, redisSet, redisDel } from '../config/redis.js';
import { invalidateUserAnalyticsCache } from './analyticsController.js';
import logger from '../utils/logger.js';

// Helper for caching Master Admin mock subscription state when no User document exists
const getMockSubKey = (user) => {
  const id = String(user?.email || user?._id || 'unknown').toLowerCase().trim();
  return `ls:tester:mock_sub:${id}`;
};

// Predefined multi-use test codes
const TEST_CODES = {
  'TEST-PRO-1MIN': { tier: 'pro', duration: '1_min' },
  'TEST-PRO-5MIN': { tier: 'pro', duration: '5_mins' },
  'TEST-PRO-1DAY': { tier: 'pro', duration: '1_day' },
  'TEST-PRO-30DAY': { tier: 'pro', duration: '30_days' },
  'TEST-BUS-1DAY': { tier: 'business', duration: '1_day' },
};

/**
 * Invalidate user session and analytics caches
 */
const flushUserCaches = async (userId) => {
  try {
    await redisDel(`ls:user:${userId}`);
    await invalidateUserAnalyticsCache(userId).catch(() => {});
  } catch (err) {
    logger.warn(`[TesterController] Cache flush warning for ${userId}: ${err.message}`);
  }
};

/**
 * Resolves the target User document for the request.
 * If req.user is a MasterAdmin (or User.findById is null), attempts to locate
 * the corresponding User document by matching email address.
 */
export const resolveTargetUser = async (req) => {
  if (!req?.user) return null;
  let user = await User.findById(req.user._id);
  if (!user && (req.user.role === 'master_admin' || req.user.type === 'master') && req.user.email) {
    user = await User.findOne({ email: req.user.email.toLowerCase() });
  }
  return user;
};

/**
 * Get current tester subscription status and remaining duration
 * GET /api/tester/status
 */
export const getTesterStatus = async (req, res) => {
  try {
    const user = await resolveTargetUser(req);
    const isMasterAdmin = req.user?.role === 'master_admin' || req.user?.type === 'master';

    if (!user) {
      if (isMasterAdmin) {
        let mockSub = null;
        try {
          mockSub = await redisGet(getMockSubKey(req.user));
        } catch {
          // Redis cache miss or outage
        }

        if (mockSub && typeof mockSub === 'object') {
          const now = Date.now();
          const periodEnd = mockSub.currentPeriodEnd ? new Date(mockSub.currentPeriodEnd).getTime() : null;
          const timeRemainingMs = periodEnd ? Math.max(0, periodEnd - now) : 0;
          const effectiveTier = getEffectiveTier({ subscription: mockSub });

          return res.json({
            tier: mockSub.tier || 'pro',
            effectiveTier,
            status: mockSub.status || 'active',
            variantId: mockSub.variantId || null,
            isTest: true,
            currentPeriodStart: mockSub.currentPeriodStart || null,
            currentPeriodEnd: mockSub.currentPeriodEnd || null,
            timeRemainingMs,
            isTester: true,
          });
        }

        const sub = req.user.subscription || { tier: 'pro', status: 'active' };
        return res.json({
          tier: sub.tier || 'pro',
          effectiveTier: sub.tier || 'pro',
          status: sub.status || 'active',
          variantId: sub.variantId || 'MASTER-ADMIN',
          isTest: false,
          currentPeriodStart: sub.currentPeriodStart || null,
          currentPeriodEnd: sub.currentPeriodEnd || null,
          timeRemainingMs: 0,
          isTester: true,
        });
      }
      return res.status(404).json({ message: 'User not found' });
    }

    const sub = user.subscription || { tier: 'free', status: 'active' };
    const effectiveTier = getEffectiveTier(user);
    const now = Date.now();
    const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : null;
    const timeRemainingMs = periodEnd ? Math.max(0, periodEnd - now) : 0;
    const isTest = Boolean(sub.isTest || String(sub.variantId || '').startsWith('TEST-'));

    res.json({
      tier: sub.tier || 'free',
      effectiveTier,
      status: sub.status || 'active',
      variantId: sub.variantId || null,
      isTest,
      currentPeriodStart: sub.currentPeriodStart || null,
      currentPeriodEnd: sub.currentPeriodEnd || null,
      timeRemainingMs,
      isTester: true,
    });
  } catch (error) {
    logger.error(`[TesterController] Status error: ${error.message}`);
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    res.status(500).json({
      message: 'Failed to retrieve tester status',
      ...(isDev ? { error: error.message } : {}),
    });
  }
};

/**
 * Redeem a tester code
 * POST /api/tester/redeem
 * Body: { code: string }
 */
export const redeemTesterCode = async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ message: 'Test code is required' });
    }

    const codeUpper = code.trim().toUpperCase();
    const matched = TEST_CODES[codeUpper];

    if (!matched) {
      return res.status(400).json({
        message: 'Invalid test code. Supported codes: TEST-PRO-1MIN, TEST-PRO-5MIN, TEST-PRO-1DAY, TEST-PRO-30DAY, TEST-BUS-1DAY',
      });
    }

    const user = await resolveTargetUser(req);
    const isMasterAdmin = req.user?.role === 'master_admin' || req.user?.type === 'master';

    if (!user && !isMasterAdmin) {
      return res.status(404).json({ message: 'User not found' });
    }

    const now = new Date();
    const endDate = calculateSubscriptionEndDate(now, matched.duration);

    const subscriptionData = {
      gateway: null,
      tier: matched.tier,
      status: 'active',
      variantId: codeUpper,
      billingCycle: 'one_time',
      currentPeriodStart: now,
      currentPeriodEnd: endDate,
      isTest: true,
    };

    if (user) {
      user.subscription = subscriptionData;
      await user.save();
      await flushUserCaches(user._id);
    }
    if (isMasterAdmin) {
      req.user.subscription = subscriptionData;
      await redisSet(getMockSubKey(req.user), 86400, subscriptionData).catch(() => {});
    }

    logger.info(`[TesterController] User ${user?.email || req.user?.email} redeemed test code: ${codeUpper} (expires ${endDate.toISOString()})`);

    res.json({
      message: `Successfully redeemed test code ${codeUpper}! Activated ${matched.tier.toUpperCase()} tier.`,
      subscription: {
        ...(user ? user.subscription.toObject() : subscriptionData),
        effectiveTier: user ? getEffectiveTier(user) : matched.tier,
      },
    });
  } catch (error) {
    logger.error(`[TesterController] Redeem error: ${error.message}`);
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    res.status(500).json({
      message: 'Failed to redeem test code',
      ...(isDev ? { error: error.message } : {}),
    });
  }
};

/**
 * Simulate buying a tier with custom duration (Mock payment gateway)
 * POST /api/tester/simulate-buy
 * Body: { tier?: 'pro' | 'business', duration?: '1m' | '5m' | '1d' | '30d' }
 */
export const simulateBuy = async (req, res) => {
  try {
    const { tier = 'pro', duration = '30d' } = req.body || {};

    const validTiers = ['pro', 'business'];
    const chosenTier = validTiers.includes(tier.toLowerCase()) ? tier.toLowerCase() : 'pro';

    // Map duration input
    let durationStr = '30_days';
    const dLower = String(duration).toLowerCase().trim();
    if (dLower === '1m' || dLower === '1_min') durationStr = '1_min';
    else if (dLower === '5m' || dLower === '5_mins') durationStr = '5_mins';
    else if (dLower === '1d' || dLower === '1_day') durationStr = '1_day';
    else if (dLower === '30d' || dLower === '30_days') durationStr = '30_days';

    const user = await resolveTargetUser(req);
    const isMasterAdmin = req.user?.role === 'master_admin' || req.user?.type === 'master';

    if (!user && !isMasterAdmin) {
      return res.status(404).json({ message: 'User not found' });
    }

    const now = new Date();
    const endDate = calculateSubscriptionEndDate(now, durationStr);
    const variantId = `TEST-${chosenTier.toUpperCase()}-${durationStr.toUpperCase()}`;

    const subscriptionData = {
      gateway: null,
      tier: chosenTier,
      status: 'active',
      variantId,
      billingCycle: durationStr === '30_days' ? 'monthly' : 'one_time',
      currentPeriodStart: now,
      currentPeriodEnd: endDate,
      isTest: true,
    };

    if (user) {
      user.subscription = subscriptionData;
      await user.save();
      await flushUserCaches(user._id);
    }
    if (isMasterAdmin) {
      req.user.subscription = subscriptionData;
      await redisSet(getMockSubKey(req.user), 86400, subscriptionData).catch(() => {});
    }

    logger.info(`[TesterController] User ${user?.email || req.user?.email} simulated buy: ${chosenTier} for ${durationStr}`);

    res.json({
      message: `Simulated purchase successful! ${chosenTier.toUpperCase()} tier active until ${endDate.toLocaleTimeString()}.`,
      subscription: {
        ...(user ? user.subscription.toObject() : subscriptionData),
        effectiveTier: user ? getEffectiveTier(user) : chosenTier,
      },
    });
  } catch (error) {
    logger.error(`[TesterController] Simulate buy error: ${error.message}`);
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    res.status(500).json({
      message: 'Failed to simulate purchase',
      ...(isDev ? { error: error.message } : {}),
    });
  }
};

/**
 * Immediately force-expire the user's active subscription
 * POST /api/tester/expire-now
 */
export const expireNow = async (req, res) => {
  try {
    const user = await resolveTargetUser(req);
    const isMasterAdmin = req.user?.role === 'master_admin' || req.user?.type === 'master';

    if (!user && !isMasterAdmin) {
      return res.status(404).json({ message: 'User not found' });
    }

    const pastDate = new Date(Date.now() - 5000); // 5s in the past

    const currentSub = (user?.subscription && user.subscription.toObject ? user.subscription.toObject() : user?.subscription) || req.user?.subscription || {};
    const subscriptionData = {
      ...currentSub,
      status: 'expired',
      tier: 'free',
      currentPeriodEnd: pastDate,
      isTest: true,
    };

    if (user) {
      user.subscription = subscriptionData;
      await user.save();
      await flushUserCaches(user._id);
    }
    if (isMasterAdmin) {
      req.user.subscription = subscriptionData;
      await redisSet(getMockSubKey(req.user), 86400, subscriptionData).catch(() => {});
    }

    logger.info(`[TesterController] User ${user?.email || req.user?.email} force-expired their subscription`);

    res.json({
      message: 'Subscription force-expired immediately. Tier downgraded to Free.',
      subscription: {
        ...subscriptionData,
        effectiveTier: 'free',
      },
    });
  } catch (error) {
    logger.error(`[TesterController] Expire now error: ${error.message}`);
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    res.status(500).json({
      message: 'Failed to expire subscription',
      ...(isDev ? { error: error.message } : {}),
    });
  }
};

/**
 * Reset user back to clean default Free plan
 * POST /api/tester/reset
 */
export const resetSubscription = async (req, res) => {
  try {
    const user = await resolveTargetUser(req);
    const isMasterAdmin = req.user?.role === 'master_admin' || req.user?.type === 'master';

    if (!user && !isMasterAdmin) {
      return res.status(404).json({ message: 'User not found' });
    }

    const subscriptionData = {
      gateway: null,
      tier: 'free',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: null,
      variantId: null,
      billingCycle: null,
      isTest: false,
    };

    if (user) {
      user.subscription = subscriptionData;
      await user.save();
      await flushUserCaches(user._id);
    }
    if (isMasterAdmin) {
      req.user.subscription = subscriptionData;
      await redisDel(getMockSubKey(req.user)).catch(() => {});
    }

    logger.info(`[TesterController] User ${user?.email || req.user?.email} reset subscription to default Free`);

    res.json({
      message: 'Subscription successfully reset to Free plan.',
      subscription: {
        ...subscriptionData,
        effectiveTier: 'free',
      },
    });
  } catch (error) {
    logger.error(`[TesterController] Reset error: ${error.message}`);
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    res.status(500).json({
      message: 'Failed to reset subscription',
      ...(isDev ? { error: error.message } : {}),
    });
  }
};

// Aliases matching alternative naming conventions
export const forceExpireSubscription = expireNow;
export const resetTesterSubscription = resetSubscription;
export const redeemTestCode = redeemTesterCode;

export default {
  resolveTargetUser,
  getTesterStatus,
  redeemTesterCode,
  redeemTestCode,
  simulateBuy,
  expireNow,
  forceExpireSubscription,
  resetSubscription,
  resetTesterSubscription,
};
