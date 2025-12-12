import Analytics from '../models/Analytics.js';
import Url from '../models/Url.js';

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

        // 2. Aggregate Data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // For the main chart, we show last 30 days (changed from 7 to match standard analytics)
        // For other stats, we ALSO limit to last 30 days to avoid scanning millions of historical records
        // This is crucial for performance on high-traffic links.

        const [clicksByDate, clicksByDevice, clicksByLocation, clicksByBrowser] = await Promise.all([
            // Clicks by Date (Last 30 Days)
            Analytics.aggregate([
                { $match: { urlId: url._id, timestamp: { $gte: thirtyDaysAgo } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),

            // Clicks by Device (Last 30 Days)
            Analytics.aggregate([
                { $match: { urlId: url._id, timestamp: { $gte: thirtyDaysAgo } } },
                { $group: { _id: "$device", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]),

            // Clicks by Location (Country) (Last 30 Days)
            Analytics.aggregate([
                { $match: { urlId: url._id, timestamp: { $gte: thirtyDaysAgo } } },
                { $group: { _id: "$country", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),

            // Clicks by Browser (Last 30 Days)
            Analytics.aggregate([
                { $match: { urlId: url._id, timestamp: { $gte: thirtyDaysAgo } } },
                { $group: { _id: "$browser", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ])
        ]);

        res.json({
            url,
            analytics: {
                clicksByDate,
                clicksByDevice,
                clicksByLocation,
                clicksByBrowser
            }
        });

    } catch (error) {
        console.error('Get Analytics Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};
