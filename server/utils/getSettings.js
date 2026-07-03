import { getRedisClient } from '../config/redis.js';
import Settings from '../models/Settings.js';
import logger from './logger.js';

/**
 * Cached Settings singleton helper.
 *
 * The Settings document is fetched from MongoDB on the first request and cached
 * in Redis for 2 minutes. Subsequent calls return the cached version instantly.
 *
 * Why: Settings.findOne() is called in 14+ places across the codebase.
 * Every auth, URL creation, and safe browsing check hits MongoDB for the same
 * global document. This utility eliminates those redundant round-trips.
 *
 * Fallback: If Redis is not configured, Settings is fetched fresh from DB
 * each time (existing behaviour preserved).
 *
 * Usage:
 *   import { getSettings, invalidateSettings } from '../utils/getSettings.js';
 *   const settings = await getSettings();
 *
 * Invalidation: call invalidateSettings() whenever an admin updates Settings.
 */

const SETTINGS_KEY = 'ls:settings:global';
const SETTINGS_TTL = 120; // seconds (2 minutes)

/**
 * Get the global Settings document (with Redis cache).
 * @returns {Promise<object|null>} Settings document or null
 */
export const getSettings = async () => {
    const redis = getRedisClient();

    // 1. Try Redis cache
    if (redis) {
        try {
            const raw = await redis.get(SETTINGS_KEY);
            if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch (err) {
            logger.warn(`[Settings Cache] Redis read failed, falling back to DB: ${err.message}`);
        }
    }

    // 2. Fetch from MongoDB
    const settings = await Settings.findOne().lean();

    // 3. Populate cache for future requests
    if (redis && settings) {
        try {
            await redis.setex(SETTINGS_KEY, SETTINGS_TTL, JSON.stringify(settings));
        } catch (err) {
            // Non-fatal — next request will re-fetch from DB
            logger.warn(`[Settings Cache] Redis write failed: ${err.message}`);
        }
    }

    return settings;
};

/**
 * Invalidate the settings cache.
 * Call this after any admin save/update of the Settings document.
 *
 * @returns {Promise<void>}
 */
export const invalidateSettings = async () => {
    const redis = getRedisClient();
    if (!redis) return;
    try {
        await redis.del(SETTINGS_KEY);
        logger.info('[Settings Cache] Cache invalidated.');
    } catch (err) {
        logger.warn(`[Settings Cache] Failed to invalidate: ${err.message}`);
    }
};
