import { LRUCache } from 'lru-cache';
import logger from '../utils/logger.js';
import { redisGet, redisSet, redisDel, getRedisClient } from '../config/redis.js';

/**
 * In-memory fallback caches for single-pod / development mode.
 * Falls back gracefully when Upstash Redis is not configured.
 */
const fallbackUrlCache = new LRUCache({
    max: 10000,              // Maximum 10,000 URLs in cache
    ttl: 1000 * 60 * 10,     // 10 minute TTL (auto-expire)
    updateAgeOnGet: true,    // Reset TTL when accessed
});

const fallbackSubCache = new LRUCache({
    max: 5000,                       // Max 5,000 users
    ttl: 1000 * 60 * 60 * 24,        // 24 hour TTL (daily renewal)
    updateAgeOnGet: false,           // Don't extend
});

// Cache statistics for monitoring
let stats = {
    hits: 0,
    misses: 0,
};

/**
 * Get a URL from cache.
 * Falls back to in-memory cache if Redis is down.
 * 
 * @param {string} shortId - The short URL identifier
 * @returns {Promise<object|null>} - Cached URL object or null
 */
export const getFromCache = async (shortId) => {
    const redis = getRedisClient();
    if (!redis) {
        const cached = fallbackUrlCache.get(shortId);
        if (cached) {
            stats.hits++;
            return cached;
        }
        stats.misses++;
        return null;
    }

    try {
        const cached = await redisGet(`ls:url:${shortId}`);
        if (cached) {
            stats.hits++;
            return cached;
        }
        stats.misses++;
        return null;
    } catch (err) {
        logger.warn(`[Cache] Redis get failed, using fallback: ${err.message}`);
        const cached = fallbackUrlCache.get(shortId);
        if (cached) stats.hits++;
        else stats.misses++;
        return cached || null;
    }
};

/**
 * Store a URL in cache.
 * Sets 10 minute TTL in Redis or in-memory fallback.
 * 
 * @param {string} shortId - The short URL identifier
 * @param {object} urlData - URL data to cache
 */
export const setInCache = async (shortId, urlData) => {
    const payload = {
        originalUrl: urlData.originalUrl,
        isActive: urlData.isActive,
        _id: urlData._id,
        ownerId: urlData.ownerId || urlData.createdBy || null,
        ownerBanned: urlData.ownerBanned,
        disableLinksOnBan: urlData.disableLinksOnBan,
        deviceRedirects: urlData.deviceRedirects || null,
        expiresAt: urlData.expiresAt || null,
        isPasswordProtected: urlData.isPasswordProtected || false,
        title: urlData.title || null,
        activeStartTime: urlData.activeStartTime || null,
        timeRedirects: urlData.timeRedirects || null,
    };

    const redis = getRedisClient();
    if (!redis) {
        fallbackUrlCache.set(shortId, payload);
        return;
    }

    try {
        // Cache for 10 minutes (600 seconds)
        await redisSet(`ls:url:${shortId}`, 600, payload);
    } catch (err) {
        logger.warn(`[Cache] Redis set failed: ${err.message}`);
        fallbackUrlCache.set(shortId, payload);
    }
};

/**
 * Remove a URL from cache.
 * 
 * @param {string} shortId - The short URL identifier
 */
export const invalidateCache = async (shortId) => {
    fallbackUrlCache.delete(shortId);
    const redis = getRedisClient();
    if (!redis) return;

    try {
        await redisDel(`ls:url:${shortId}`);
    } catch (err) {
        logger.warn(`[Cache] Redis invalidate failed: ${err.message}`);
    }
};

/**
 * Invalidate multiple URLs from cache (for batch operations).
 * 
 * @param {string[]} shortIds - Array of short URL identifiers
 * @returns {Promise<number>} - Number of entries invalidated
 */
export const invalidateMultiple = async (shortIds) => {
    let count = 0;
    
    // Invalidate fallbacks
    for (const shortId of shortIds) {
        if (fallbackUrlCache.has(shortId)) {
            fallbackUrlCache.delete(shortId);
            count++;
        }
    }

    const redis = getRedisClient();
    if (!redis || shortIds.length === 0) {
        return count;
    }

    try {
        const keys = shortIds.map(id => `ls:url:${id}`);
        await redisDel(...keys);
        logger.info(`[Cache] Invalidated ${shortIds.length} keys in Redis`);
        return shortIds.length;
    } catch (err) {
        logger.warn(`[Cache] Redis batch invalidate failed: ${err.message}`);
        return count;
    }
};

/**
 * Clear entire cache (useful for admin operations).
 */
export const clearCache = async () => {
    fallbackUrlCache.clear();
    fallbackSubCache.clear();
    stats = { hits: 0, misses: 0 };

    const redis = getRedisClient();
    if (!redis) {
        logger.info('In-memory cache cleared');
        return;
    }

    try {
        // Find all cache keys and delete them.
        // We use keys for administrative clear operations.
        const urlKeys = await redis.keys('ls:url:*');
        const subKeys = await redis.keys('ls:sub:*');
        const allKeys = [...urlKeys, ...subKeys];
        
        if (allKeys.length > 0) {
            await redisDel(...allKeys);
        }
        logger.info(`[Cache] Cleared ${allKeys.length} Redis cache keys`);
    } catch (err) {
        logger.warn(`[Cache] Redis clear failed: ${err.message}`);
    }
};

/**
 * Get cache statistics.
 * 
 * @returns {object} - Cache stats { hits, misses, hitRate, size }
 */
export const getCacheStats = () => {
    const total = stats.hits + stats.misses;
    return {
        hits: stats.hits,
        misses: stats.misses,
        hitRate: total > 0 ? ((stats.hits / total) * 100).toFixed(2) + '%' : '0%',
        size: fallbackUrlCache.size,
        maxSize: fallbackUrlCache.max,
        subscriptionCacheSize: fallbackSubCache.size,
    };
};

// ============= Subscription Cache Functions =============

/**
 * Get cached subscription data for a user.
 * 
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} - Cached subscription data or null
 */
export const getSubscriptionCache = async (userId) => {
    const redis = getRedisClient();
    if (!redis) {
        return fallbackSubCache.get(userId) || null;
    }

    try {
        return await redisGet(`ls:sub:${userId}`);
    } catch (err) {
        logger.warn(`[Cache] Redis subscription get failed: ${err.message}`);
        return fallbackSubCache.get(userId) || null;
    }
};

/**
 * Cache subscription data for a user (24h TTL).
 * 
 * @param {string} userId - User ID
 * @param {object} subData - Subscription and role data
 */
export const setSubscriptionCache = async (userId, subData) => {
    const payload = {
        subscription: subData.subscription || null,
        role: subData.role || 'user',
    };

    const redis = getRedisClient();
    if (!redis) {
        fallbackSubCache.set(userId, payload);
        return;
    }

    try {
        // Cache for 24 hours (86400 seconds)
        await redisSet(`ls:sub:${userId}`, 86400, payload);
    } catch (err) {
        logger.warn(`[Cache] Redis subscription set failed: ${err.message}`);
        fallbackSubCache.set(userId, payload);
    }
};

/**
 * Invalidate subscription cache (call on subscription change).
 * 
 * @param {string} userId - User ID
 */
export const invalidateSubscriptionCache = async (userId) => {
    fallbackSubCache.delete(userId);
    const redis = getRedisClient();
    if (!redis) return;

    try {
        await redisDel(`ls:sub:${userId}`);
    } catch (err) {
        logger.warn(`[Cache] Redis subscription invalidate failed: ${err.message}`);
    }
};

export default {
    get: getFromCache,
    set: setInCache,
    invalidate: invalidateCache,
    invalidateMultiple,
    clear: clearCache,
    stats: getCacheStats,
    getSubscription: getSubscriptionCache,
    setSubscription: setSubscriptionCache,
    invalidateSubscription: invalidateSubscriptionCache,
};
