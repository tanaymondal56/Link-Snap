import Url from '../models/Url.js';
import Analytics from '../models/Analytics.js';
import { invalidateCache } from '../services/cacheService.js';

// @desc    Get all links (paginated, searchable)
// @route   GET /api/admin/links
// @access  Admin
export const getAllLinks = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const skip = (page - 1) * limit;

        let query = {};
        if (search) {
            // Escape special regex characters to prevent ReDoS attacks
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query = {
                $or: [
                    { originalUrl: { $regex: escapedSearch, $options: 'i' } },
                    { shortId: { $regex: escapedSearch, $options: 'i' } },
                    { title: { $regex: escapedSearch, $options: 'i' } }
                ]
            };
        }

        const urls = await Url.find(query)
            .populate('createdBy', 'email isActive disableLinksOnBan')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Compute ownerBanned field for each URL
        const urlsWithBanStatus = urls.map(url => {
            const urlObj = url.toObject();
            // ownerBanned = owner exists AND is not active AND has disableLinksOnBan true
            urlObj.ownerBanned = !!(urlObj.createdBy && !urlObj.createdBy.isActive && urlObj.createdBy.disableLinksOnBan);
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
        const url = await Url.findById(req.params.id);

        if (!url) {
            return res.status(404).json({ message: 'URL not found' });
        }

        url.isActive = !url.isActive;
        await url.save();

        // Invalidate cache so the new status takes effect immediately
        invalidateCache(url.shortId);
        if (url.customAlias) {
            invalidateCache(url.customAlias);
        }

        res.json({ message: `Link ${url.isActive ? 'activated' : 'disabled'}`, url });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete link (Admin)
// @route   DELETE /api/admin/links/:id
// @access  Admin
export const deleteLinkAdmin = async (req, res) => {
    try {
        const url = await Url.findById(req.params.id);

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
