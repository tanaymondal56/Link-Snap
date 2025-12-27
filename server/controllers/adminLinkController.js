import Url from '../models/Url.js';
import Analytics from '../models/Analytics.js';
import User from '../models/User.js';
import { invalidateCache } from '../services/cacheService.js';

// @desc    Get all links (paginated, searchable)
// @route   GET /api/admin/links
// @access  Admin
export const getAllLinks = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const status = req.query.status || 'all'; // 'all', 'active', 'disabled', 'expired'
        const skip = (page - 1) * limit;

        let query = {};
        
        // Search Logic
        if (search) {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // Find users matching the search term to include in link search (Limit 50 to prevent massive In queries)
            const matchingUsers = await User.find({
                $or: [
                    { email: { $regex: escapedSearch, $options: 'i' } },
                    { username: { $regex: escapedSearch, $options: 'i' } }
                ]
            }).select('_id').limit(50);
            const matchingUserIds = matchingUsers.map(user => user._id);

            query.$or = [
                { originalUrl: { $regex: escapedSearch, $options: 'i' } },
                { shortId: { $regex: escapedSearch, $options: 'i' } },
                { customAlias: { $regex: escapedSearch, $options: 'i' } }, // Added customAlias
                { title: { $regex: escapedSearch, $options: 'i' } },
                { createdBy: { $in: matchingUserIds } } // Added Owner Search
            ];
        }

        // Status Filtering
        const now = new Date();
        if (status === 'active') {
            query.isActive = true;
            // Active means not expired
            query.$and = [
                { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }
            ];
        } else if (status === 'disabled') {
            query.isActive = false;
        } else if (status === 'expired') {
            query.expiresAt = { $lte: now };
        }

        const urls = await Url.find(query)
            .populate('createdBy', 'email username isActive disableLinksOnBan')
            .sort({ createdAt: -1 }) // TODO: Remove this when Cosmos DB has createdAt index
            .skip(skip)
            .limit(limit);

        // Compute ownerBanned field for each URL
        const urlsWithBanStatus = urls.map(url => {
            const urlObj = url.toObject();
            // ownerBanned = owner exists AND is not active (regardless of disableLinksOnBan)
            urlObj.ownerBanned = !!(urlObj.createdBy && !urlObj.createdBy.isActive);
            return urlObj;
        });

        const total = await Url.countDocuments(query);

        res.json({
            urls: urlsWithBanStatus,
            page,
            pages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Toggle link status (Disable/Enable)
// @route   PATCH /api/admin/links/:id/status
// @access  Admin
export const updateLinkStatus = async (req, res) => {
    try {
        const url = await Url.findById(req.params.linkId);

        if (!url) {
            return res.status(404).json({ message: 'URL not found' });
        }

        // Atomic toggle of isActive status
        const newStatus = !url.isActive;
        const updatedUrl = await Url.findByIdAndUpdate(
            req.params.linkId,
            { $set: { isActive: newStatus } },
            { new: true }
        );

        // Invalidate cache so the new status takes effect immediately
        invalidateCache(url.shortId);
        if (url.customAlias) {
            invalidateCache(url.customAlias);
        }

        res.json({ message: `Link ${newStatus ? 'activated' : 'disabled'}`, url: updatedUrl });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete link (Admin)
// @route   DELETE /api/admin/links/:id
// @access  Admin
export const deleteLinkAdmin = async (req, res) => {
    try {
        const url = await Url.findById(req.params.linkId);

        if (!url) {
            return res.status(404).json({ message: 'URL not found' });
        }

        // Invalidate cache before deleting
        invalidateCache(url.shortId);
        if (url.customAlias) {
            invalidateCache(url.customAlias);
        }

        // Delete analytics
        await Analytics.deleteMany({ urlId: url._id });

        // Delete URL
        await url.deleteOne();

        res.json({ message: 'Link and associated data removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
