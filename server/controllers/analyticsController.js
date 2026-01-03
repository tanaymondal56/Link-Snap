import Analytics from '../models/Analytics.js';
import Url from '../models/Url.js';

import { TIERS, getEffectiveTier } from '../services/subscriptionService.js';

export const getUrlAnalytics = async (req, res) => {
    const { shortId } = req.params;
    const userId = req.user._id;

    try {
        // 1. Verify ownership of the URL
        const url = await Url.findOne({
            $or: [{ shortId }, { customAlias: shortId }],
            createdBy: userId
        });

        if (!url) {
            return res.status(404).json({ message: 'URL not found or unauthorized' });
        }

        // 2. Determine Retention Period based on Tier
        const tier = getEffectiveTier(req.user);
        const retentionDays = TIERS[tier]?.analyticsRetention || TIERS.free.analyticsRetention;
        
        const retentionDate = new Date();
        // If Infinity (Business), set to very old date (e.g., 2000) or handle differently
        // Since Mongo doesn't handle Infinity well in date math, we use a large number if Infinity
        if (retentionDays === Infinity) {
             retentionDate.setFullYear(2000); // Effectively all history
        } else {
             retentionDate.setDate(retentionDate.getDate() - retentionDays);
        }
        
        // 3. Aggregate Data
        // We filter by timestamp > retentionDate

        const [clicksByDate, clicksByDevice, clicksByLocation, clicksByBrowser, clicksByDeviceMatch] = await Promise.all([
            // Clicks by Date (Last 30 Days)
            Analytics.aggregate([
                { $match: { urlId: url._id, timestamp: { $gte: retentionDate } } },
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
                { $match: { urlId: url._id, timestamp: { $gte: retentionDate } } },
                { $group: { _id: "$device", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]),

            // Clicks by Location (Country) (Retention filtered)
            Analytics.aggregate([
                { $match: { urlId: url._id, timestamp: { $gte: retentionDate } } },
                { $group: { _id: "$country", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),

            // Clicks by Browser (Retention filtered)
            Analytics.aggregate([
                { $match: { urlId: url._id, timestamp: { $gte: retentionDate } } },
                { $group: { _id: "$browser", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]),

            // Clicks by Device Match Type (Pro/Business feature - shows device targeting effectiveness)
            Analytics.aggregate([
                { $match: { urlId: url._id, timestamp: { $gte: retentionDate }, deviceMatchType: { $ne: null } } },
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
        console.error('Get Analytics Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
