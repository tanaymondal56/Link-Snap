import Tester from '../models/Tester.js';
import { redisGet, redisSet } from '../config/redis.js';
import logger from '../utils/logger.js';

/**
 * Checks if a given user is an authorized tester.
 * 
 * 1. Automatically authorizes admins and master_admins.
 * 2. Checks Redis cache (`ls:tester:<email>`).
 * 3. Gracefully falls back to MongoDB if cache miss or Redis outage occurs.
 * 4. Caches MongoDB result in Redis for 300 seconds.
 * 
 * @param {Object} user - User object containing email and role
 * @returns {Promise<boolean>} True if user is authorized tester or admin
 */
export const isUserAuthorizedTester = async (user) => {
  if (!user || !user.email) {
    return false;
  }

  // Admins & Master Admins are automatically authorized
  if (user.role === 'admin' || user.role === 'master_admin' || user.role === 'master' || user.type === 'master') {
    return true;
  }

  const emailClean = String(user.email).toLowerCase().trim();
  const cacheKey = `ls:tester:${emailClean}`;

  try {
    const cached = await redisGet(cacheKey);
    // Resilient check across ioredis / Upstash / string representations
    if (typeof cached === 'boolean') {
      return cached;
    }
    if (cached === 'true' || cached === 'false') {
      return cached === 'true';
    }
    // If cached is null (cache miss) or undefined (Redis outage/unreachable), fall through to DB
  } catch (err) {
    logger.warn(`[TesterMiddleware] Redis check error for ${emailClean}: ${err.message}`);
  }

  // Graceful fallback to MongoDB
  try {
    const tester = await Tester.findOne({ email: emailClean, isActive: true }).select('_id').lean();
    const isAuthorized = Boolean(tester);

    // Cache result in Redis for 300s (5 mins)
    await redisSet(cacheKey, 300, isAuthorized).catch(() => {});

    return isAuthorized;
  } catch (err) {
    logger.error(`[TesterMiddleware] MongoDB fallback error for ${emailClean}: ${err.message}`);
    return false;
  }
};

/**
 * Express middleware to strictly require an authorized tester or admin.
 * Fails closed with HTTP 404 Not Found to preserve Ghost Mode.
 */
export const requireTester = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const authorized = await isUserAuthorizedTester(req.user);
  if (!authorized) {
    // Preserve Ghost Mode: attackers / unauthorized users must not even know this endpoint exists
    return res.status(404).json({ message: 'Not found' });
  }

  next();
};

export default {
  isUserAuthorizedTester,
  requireTester,
};
