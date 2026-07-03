import { redisGet, redisSet, redisDel } from '../config/redis.js';
import Settings from '../models/Settings.js';
import logger from './logger.js';

/**
 * Cached Settings singleton helper.
 *
 * PERSISTENCE MODEL:
 * ──────────────────
 * MongoDB is the persistent truth. Redis is a 2-minute read cache.
 *
 * If Redis is down / key evicted:
 *   → Falls back to Settings.findOne() (one extra DB query, zero data loss)
 *   → On success, re-populates the cache for the next 2 minutes
 *
 * The Settings document changes only when an admin updates it — very rarely.
 * A 2-minute TTL means a worst-case 2-minute propagation lag after an update,
 * which is acceptable for global configuration values.
 *
 * Why: Settings.findOne() is called in 14+ places across the codebase.
 * Every auth, URL creation, safe browsing check, and webhook hits MongoDB
 * for the same global document. This eliminates those round-trips.
 *
 * Usage:
 *   import { getSettings, invalidateSettings } from '../utils/getSettings.js';
 *   const settings = await getSettings();
 *
 * On settings save (adminController.js):
 *   await settings.save();
 *   await invalidateSettings(); // ← call this after every save()
 */

const SETTINGS_KEY = 'ls:settings:global';
const SETTINGS_TTL = 120; // 2 minutes — aligns with how rarely settings change

/**
 * Get the global Settings document (with Redis cache + MongoDB fallback).
 * Never throws — returns null only if both Redis and MongoDB fail.
 *
 * @returns {Promise<object|null>}
 */
export const getSettings = async () => {
    // 1. Try Redis cache first
    const cached = await redisGet(SETTINGS_KEY);
    if (cached) return cached;

    // 2. Cache miss (or Redis unavailable) — fetch from MongoDB
    let settings = null;
    try {
        settings = await Settings.findOne().lean();
    } catch (err) {
        logger.error(`[Settings] MongoDB fallback failed: ${err.message}`);
        return null;
    }

    // 3. Re-populate cache for next request
    if (settings) {
        await redisSet(SETTINGS_KEY, SETTINGS_TTL, settings);
    }

    return settings;
};

/**
 * Invalidate the settings cache.
 * Call immediately after any admin save() of the Settings document.
 * Next request will fetch fresh from MongoDB and re-prime the cache.
 *
 * @returns {Promise<void>}
 */
export const invalidateSettings = async () => {
    await redisDel(SETTINGS_KEY);
    logger.info('[Settings] Cache invalidated — next read will fetch from DB.');
};
