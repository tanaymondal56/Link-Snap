import Analytics from '../models/Analytics.js';
import Url from '../models/Url.js';
import logger from '../utils/logger.js';
import { TIERS, getEffectiveTier } from '../services/subscriptionService.js';
import { redisGet, redisSet, redisDel } from '../config/redis.js';
import zlib from 'zlib';
import { promisify } from 'util';

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
            }).populate('createdBy', 'email username');
        } else {
            // Regular users can only view their own links
            url = await Url.findOne({
                $or: [{ shortId }, { customAlias: shortId }],
                createdBy: userId
            });
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

        // 3. Check Redis cache — keyed by shortId + tier to prevent cross-tier data leaks
        // Admin cache is separate (no retention limit) and user caches are per-tier.
        const cacheKey = `ls:analytics:${url._id}:${tier}`;
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
        
        // 4. Aggregate Data — 5 concurrent aggregations
        const [clicksByDate, clicksByDevice, clicksByLocation, clicksByBrowser, clicksByDeviceMatch] = await Promise.all([
            // Clicks by Date (Last 30 Days or all history)
            Analytics.aggregate([
                matchStage(),
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),

            // Clicks by Device (Retention filtered)
            Analytics.aggregate([
                matchStage(),
                { $group: { _id: "$device", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]),

            // Clicks by Location (Country) (Retention filtered)
            Analytics.aggregate([
                matchStage(),
                { $group: { _id: "$country", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),

            // Clicks by Browser (Retention filtered)
            Analytics.aggregate([
                matchStage(),
                { $group: { _id: "$browser", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]),

            // Clicks by Device Match Type (Pro/Business feature - shows device targeting effectiveness)
            Analytics.aggregate([
                matchStage({ deviceMatchType: { $ne: null } }),
                { $group: { _id: "$deviceMatchType", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
        ]);

        const analyticsData = {
            clicksByDate,
            clicksByDevice,
            clicksByLocation,
            clicksByBrowser,
            clicksByDeviceMatch  // Device targeting analytics
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
 */
export const invalidateAnalyticsCache = async (urlId) => {
    await redisDel(
        `ls:analytics:${urlId}:free`,
        `ls:analytics:${urlId}:pro`,
        `ls:analytics:${urlId}:business`,
    );
};

/**
 * Invalidate all cached analytics for a specific user.
 * Called when a user's subscription tier changes.
 */
export const invalidateUserAnalyticsCache = async (userId) => {
    try {
        const userUrls = await Url.find({ createdBy: userId }).select('_id').lean();
        if (!userUrls.length) return;
        const keysToDel = userUrls.flatMap(u => [
            `ls:analytics:${u._id}:free`,
            `ls:analytics:${u._id}:pro`,
            `ls:analytics:${u._id}:business`,
        ]);
        
        // Batch delete to avoid hitting Redis argument limits
        const BATCH_SIZE = 500;
        for (let i = 0; i < keysToDel.length; i += BATCH_SIZE) {
            await redisDel(...keysToDel.slice(i, i + BATCH_SIZE));
        }
    } catch (err) {
        logger.error(`[Analytics] Failed to invalidate user cache: ${err.message}`);
    }
};
