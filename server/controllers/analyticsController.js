import Analytics from '../models/Analytics.js';
import Url from '../models/Url.js';
import logger from '../utils/logger.js';
import { TIERS, getEffectiveTier } from '../services/subscriptionService.js';

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
        
        // Helper to build match stage dynamically (saves DB overhead when retention is Infinity)
        const matchStage = (extraConditions = {}) => {
             const conditions = { urlId: url._id, ...extraConditions };
             if (retentionDate) {
                 conditions.timestamp = { $gte: retentionDate };
             }
             return { $match: conditions };
        };
        
        // 3. Aggregate Data
        // We filter by timestamp > retentionDate

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

        res.json({
            url,
            analytics: {
                clicksByDate,
                clicksByDevice,
                clicksByLocation,
                clicksByBrowser,
                clicksByDeviceMatch  // Device targeting analytics
            }
        });

    } catch (error) {
        logger.error('[Analytics] Get Analytics Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
