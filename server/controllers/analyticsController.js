import Analytics from '../models/Analytics.js';
import Url from '../models/Url.js';
import logger from '../utils/logger.js';
import { TIERS, getEffectiveTier } from '../services/subscriptionService.js';
import { redisGet, redisSet, redisDel, redisScan } from '../config/redis.js';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

// Cache analytics for 3 minutes — short enough to feel near-real-time,
// long enough to eliminate redundant aggregations on rapid dashboard refreshes.
const ANALYTICS_TTL = 180;

export const getUrlAnalytics = async (req, res) => {
    const { shortId } = req.params;
    const userId = req.user._id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'master_admin';

    try {
        // 1. Find the URL - Admins can view any link, regular users only their own
        let url;
        if (isAdmin) {
            // Admins can view any link's analytics
            url = await Url.findOne({
                $or: [{ shortId }, { customAlias: shortId }]
            }).populate('createdBy', 'email username').lean();
        } else {
            // Regular users can only view their own links
            url = await Url.findOne({
                $or: [{ shortId }, { customAlias: shortId }],
                createdBy: userId
            }).lean();
        }

        if (!url) {
            return res.status(404).json({ message: 'URL not found or unauthorized' });
        }

        // 2. Determine Retention Period based on Tier (for admins, show all history)
        const tier = isAdmin ? 'business' : getEffectiveTier(req.user);
        const retentionDays = TIERS[tier]?.analyticsRetention || TIERS.free.analyticsRetention;
        
        let retentionDate = null;
        if (retentionDays !== Infinity) {
             retentionDate = new Date();
             retentionDate.setDate(retentionDate.getDate() - retentionDays);
        }

        // 3. Resolve user/client timezone for calendar date grouping
        const requestedTz = req.query.tz || req.headers['x-timezone'] || 'UTC';
        let validTz = 'UTC';
        if (requestedTz && typeof requestedTz === 'string') {
            try {
                Intl.DateTimeFormat(undefined, { timeZone: requestedTz.trim() });
                validTz = requestedTz.trim();
            } catch {
                validTz = 'UTC';
            }
        }

        // 4. Check Redis cache — keyed by url._id + tier + timezone to prevent cross-tier and cross-tz data leaks
        const cacheKey = `ls:analytics:${url._id}:${tier}:${encodeURIComponent(validTz)}`;
        let cached = await redisGet(cacheKey);
        
        // Handle decompression if payload was gzipped
        if (typeof cached === 'string' && cached.startsWith('gzip:')) {
            try {
                const buffer = Buffer.from(cached.slice(5), 'base64');
                const decompressed = await gunzipAsync(buffer);
                cached = JSON.parse(decompressed.toString());
            } catch (err) {
                logger.warn(`[Analytics] Failed to decompress cache for ${shortId}: ${err.message}`);
                cached = null; // Fall back to DB query
            }
        }

        if (cached) {
            // Always return fresh URL object (click count etc may update), inject cached analytics
            return res.json({ url, analytics: cached });
        }
        
        // Helper to build match stage dynamically (saves DB overhead when retention is Infinity)
        const matchStage = (extraConditions = {}) => {
             const conditions = { urlId: url._id, ...extraConditions };
             if (retentionDate) {
                 conditions.timestamp = { $gte: retentionDate };
             }
             return { $match: conditions };
        };
        
        // 5. Aggregate Data — Single roundtrip $facet pipeline with timezone-aware date bucketing
        const [aggregationResult] = await Analytics.aggregate([
            matchStage(),
            {
                $facet: {
                    clicksByDate: [
                        {
                            $group: {
                                _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp", timezone: validTz } },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ],
                    clicksByDevice: [
                        { $group: { _id: "$device", count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 5 }
                    ],
                    clicksByLocation: [
                        { $group: { _id: "$country", count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 10 }
                    ],
                    clicksByBrowser: [
                        { $group: { _id: "$browser", count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 5 }
                    ],
                    clicksByDeviceMatch: [
                        { $match: { deviceMatchType: { $ne: null } } },
                        { $group: { _id: "$deviceMatchType", count: { $sum: 1 } } },
                        { $sort: { count: -1 } }
                    ]
                }
            }
        ]);

        const analyticsData = {
            clicksByDate: aggregationResult?.clicksByDate || [],
            clicksByDevice: aggregationResult?.clicksByDevice || [],
            clicksByLocation: aggregationResult?.clicksByLocation || [],
            clicksByBrowser: aggregationResult?.clicksByBrowser || [],
            clicksByDeviceMatch: aggregationResult?.clicksByDeviceMatch || []
        };

        // 5. Store aggregated analytics in Redis (fire-and-forget, don't block response)
        (async () => {
            try {
                const payloadString = JSON.stringify(analyticsData);
                // Compress payloads larger than 50KB
                if (payloadString.length > 50000) {
                    const compressed = await gzipAsync(payloadString);
                    const base64Str = compressed.toString('base64');
                    await redisSet(cacheKey, ANALYTICS_TTL, 'gzip:' + base64Str);
                } else {
                    await redisSet(cacheKey, ANALYTICS_TTL, analyticsData);
                }
            } catch (err) {
                logger.warn(`[Analytics] Cache set failed for ${shortId}: ${err.message}`);
            }
        })();

        res.json({ url, analytics: analyticsData });

    } catch (error) {
        logger.error('[Analytics] Get Analytics Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * Invalidate cached analytics for a specific URL.
 * Called when a link is deleted or when an admin forces a refresh.
 * Purges all keys matching ls:analytics:${urlId}:* across all tiers and timezones.
 */
export const invalidateAnalyticsCache = async (urlId) => {
    try {
        let cursor = 0;
        do {
            const [nextCursor, keys] = await redisScan(cursor, `ls:analytics:${urlId}:*`, 100);
            if (keys && keys.length > 0) {
                await redisDel(...keys);
            }
            cursor = Number(nextCursor) === 0 ? 0 : nextCursor;
        } while (cursor !== 0);
    } catch (err) {
        logger.error(`[Analytics] Failed to invalidate analytics cache for ${urlId}: ${err.message}`);
    }

    // Direct fallback deletion for standard UTC and legacy keys
    await redisDel(
        `ls:analytics:${urlId}:free:UTC`,
        `ls:analytics:${urlId}:pro:UTC`,
        `ls:analytics:${urlId}:business:UTC`,
        `ls:analytics:${urlId}:free`,
        `ls:analytics:${urlId}:pro`,
        `ls:analytics:${urlId}:business`
    ).catch(() => {});
};

/**
 * Invalidate all cached analytics for a specific user.
 * Called when a user's subscription tier changes.
 */
export const invalidateUserAnalyticsCache = async (userId) => {
    try {
        const userUrls = await Url.find({ createdBy: userId }).select('_id').lean();
        if (!userUrls.length) return;
        
        // Purge analytics keys for each user URL using pattern deletion
        const BATCH_SIZE = 50;
        for (let i = 0; i < userUrls.length; i += BATCH_SIZE) {
            await Promise.all(userUrls.slice(i, i + BATCH_SIZE).map(u => invalidateAnalyticsCache(u._id)));
        }
    } catch (err) {
        logger.error(`[Analytics] Failed to invalidate user cache: ${err.message}`);
    }
};
