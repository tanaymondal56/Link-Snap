import { LRUCache } from 'lru-cache';
import logger from '../utils/logger.js';

/**
 * In-memory LRU Cache for URL redirects
 * Reduces database queries for frequently accessed links
 * 
 * Trade-offs vs Redis:
 * - ✅ No external dependency
 * - ✅ Zero latency (in-process)
 * - ✅ Free forever
 * - ❌ Not shared across server instances
 * - ❌ Lost on server restart
 */

const urlCache = new LRUCache({
    max: 10000,              // Maximum 10,000 URLs in cache
    ttl: 1000 * 60 * 10,     // 10 minute TTL (auto-expire)
    updateAgeOnGet: true,    // Reset TTL when accessed (keep hot URLs longer)
    updateAgeOnHas: false,
});

// Cache statistics for monitoring
let stats = {
    hits: 0,
    misses: 0,
};

/**
 * Get a URL from cache
 * @param {string} shortId - The short URL identifier
 * @returns {object|null} - Cached URL object or null
 */
export const getFromCache = (shortId) => {
    const cached = urlCache.get(shortId);
    if (cached) {
        stats.hits++;
        return cached;
    }
    stats.misses++;
    return null;
};

/**
 * Store a URL in cache
 * @param {string} shortId - The short URL identifier
 * @param {object} urlData - URL data to cache
 */
export const setInCache = (shortId, urlData) => {
    urlCache.set(shortId, {
        originalUrl: urlData.originalUrl,
        isActive: urlData.isActive,
        _id: urlData._id,
        ownerId: urlData.ownerId || urlData.createdBy || null,
        ownerBanned: urlData.ownerBanned,
        disableLinksOnBan: urlData.disableLinksOnBan,
        // Device-based redirects (Pro/Business feature)
        deviceRedirects: urlData.deviceRedirects || null,
        // Link expiration
        expiresAt: urlData.expiresAt || null,
        // Password protection (redirect controller needs this)
        isPasswordProtected: urlData.isPasswordProtected || false,
    });
};

/**
 * Remove a URL from cache (call when URL is updated/deleted)
 * @param {string} shortId - The short URL identifier
 */
export const invalidateCache = (shortId) => {
    urlCache.delete(shortId);
};

/**
 * Invalidate multiple URLs from cache (for batch operations)
 * @param {string[]} shortIds - Array of short URL identifiers
 * @returns {number} - Number of entries invalidated
 */
export const invalidateMultiple = (shortIds) => {
    let count = 0;
    for (const shortId of shortIds) {
        if (urlCache.has(shortId)) {
            urlCache.delete(shortId);
            count++;
        }
    }
    if (count > 0) {
        logger.info(`Cache invalidated ${count} URLs`);
    }
    return count;
};

/**
 * Clear entire cache (useful for admin operations)
 */
export const clearCache = () => {
    urlCache.clear();
    stats = { hits: 0, misses: 0 };
    logger.info('URL cache cleared');
};

/**
 * Get cache statistics
 * @returns {object} - Cache stats { hits, misses, hitRate, size }
 */
export const getCacheStats = () => {
    const total = stats.hits + stats.misses;
    return {
        hits: stats.hits,
        misses: stats.misses,
        hitRate: total > 0 ? ((stats.hits / total) * 100).toFixed(2) + '%' : '0%',
        size: urlCache.size,
        maxSize: urlCache.max,
    };
};

export default {
    get: getFromCache,
    set: setInCache,
    invalidate: invalidateCache,
    invalidateMultiple,
    clear: clearCache,
    stats: getCacheStats,
};
