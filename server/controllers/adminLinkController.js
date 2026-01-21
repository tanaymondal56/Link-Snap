import mongoose from 'mongoose';
import Url from '../models/Url.js';
import Analytics from '../models/Analytics.js';
import User from '../models/User.js';
import { invalidateCache } from '../services/cacheService.js';
import { checkUrlsSafety } from '../services/safeBrowsingService.js';
import logger from '../utils/logger.js';

// @desc    Get all links (paginated, searchable)
// @route   GET /api/admin/links
// @access  Admin
export const getAllLinks = async (req, res) => {
    try {
        // Input validation - Whitelist approach (most secure)
        const ALLOWED_STATUSES = ['all', 'active', 'disabled', 'expired'];
        const ALLOWED_SAFETY_STATUSES = ['all', 'safe', 'malware', 'phishing', 'pending', 'unchecked', 'unwanted'];

        // Validate and sanitize input parameters
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const search = String(req.query.search || '').trim().substring(0, 100); // Limit length

        // Validate status: only allow whitelisted values, default to 'all'
        const status = ALLOWED_STATUSES.includes(String(req.query.status || '')) ? String(req.query.status) : 'all';

        // Validate safety: only allow whitelisted values, default to 'all'
        const safety = ALLOWED_SAFETY_STATUSES.includes(String(req.query.safety || '')) ? String(req.query.safety) : 'all';

        const skip = (page - 1) * limit;

        const matchStage = {};
        const now = new Date();


        // Search Logic - Build conditions for aggregation
        let searchUserIds = [];
        if (search) {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Find users matching the search term (optimized with text index if available)
            try {
                const matchingUsers = await User.find(
                    { $text: { $search: search } },
                    { score: { $meta: 'textScore' } }
                ).select('_id').limit(50).sort({ score: { $meta: 'textScore' } });
                searchUserIds = matchingUsers.map(user => user._id);
            } catch {
                // Fallback to regex if text index not available
                const matchingUsers = await User.find({
                    $or: [
                        { email: { $regex: escapedSearch, $options: 'i' } },
                        { username: { $regex: escapedSearch, $options: 'i' } }
                    ]
                }).select('_id').limit(50);
                searchUserIds = matchingUsers.map(user => user._id);
            }

            matchStage.$or = [
                { originalUrl: { $regex: escapedSearch, $options: 'i' } },
                { shortId: { $regex: escapedSearch, $options: 'i' } },
                { customAlias: { $regex: escapedSearch, $options: 'i' } },
                { title: { $regex: escapedSearch, $options: 'i' } },
                ...(searchUserIds.length > 0 ? [{ createdBy: { $in: searchUserIds } }] : [])
            ];
        }

        // Status Filtering - Optimized to use compound indexes
        if (status === 'active') {
            matchStage.isActive = true;
            matchStage.$and = matchStage.$and || [];
            matchStage.$and.push({ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] });
        } else if (status === 'disabled') {
            matchStage.isActive = false;
        } else if (status === 'expired') {
            matchStage.expiresAt = { $lte: now };
        }

        // Safety Status Filtering - Uses compound index { safetyStatus: 1, createdAt: -1 }
        // Safety values are already whitelisted above
        if (safety !== 'all') {
            matchStage.safetyStatus = safety;
        }

        // Use concurrent queries for better compatibility (avoids $lookup inside $facet limitations)
        const [urls, total] = await Promise.all([
            Url.aggregate([
                { $match: matchStage },
                { $sort: { createdAt: -1 } },
                { $skip: skip },
                { $limit: limit },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'createdBy',
                        foreignField: '_id',
                        as: 'createdByData'
                    }
                },
                {
                    $addFields: {
                        // Extract only needed fields from the looked-up user (Direct array access, no variables)
                        createdBy: {
                            _id: { $arrayElemAt: ['$createdByData._id', 0] },
                            email: { $arrayElemAt: ['$createdByData.email', 0] },
                            username: { $arrayElemAt: ['$createdByData.username', 0] },
                            isActive: { $arrayElemAt: ['$createdByData.isActive', 0] },
                            disableLinksOnBan: { $arrayElemAt: ['$createdByData.disableLinksOnBan', 0] }
                        },
                        ownerBanned: {
                            $cond: {
                                if: {
                                    $and: [
                                        { $gt: [{ $size: '$createdByData' }, 0] },
                                        { $eq: [{ $arrayElemAt: ['$createdByData.isActive', 0] }, false] }
                                    ]
                                },
                                then: true,
                                else: false
                            }
                        }
                    }
                },
                { $project: { createdByData: 0 } }
            ]),
            Url.countDocuments(matchStage)
        ]);

        res.json({
            urls,
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

// @desc    Override link safety status (Admin Manual Override)
// @route   PATCH /api/admin/links/:linkId/safety
// @access  Admin
export const overrideLinkSafety = async (req, res) => {
    try {
        // Security: Validate ObjectId format to prevent injection
        if (!mongoose.Types.ObjectId.isValid(req.params.linkId)) {
            return res.status(400).json({ message: 'Invalid link ID format' });
        }

        const { safetyStatus } = req.body;
        const allowedStatuses = ['safe', 'malware', 'phishing', 'pending', 'unwanted'];

        if (!safetyStatus || !allowedStatuses.includes(safetyStatus)) {
            return res.status(400).json({
                message: `Invalid safety status. Allowed: ${allowedStatuses.join(', ')}`
            });
        }

        const url = await Url.findById(req.params.linkId);
        if (!url) {
            return res.status(404).json({ message: 'URL not found' });
        }

        const previousStatus = url.safetyStatus;

        // Update with manual override flag to prevent background scan from overwriting
        const updatedUrl = await Url.findByIdAndUpdate(
            req.params.linkId,
            {
                $set: {
                    safetyStatus,
                    safetyDetails: `Manual override by admin (was: ${previousStatus})`,
                    lastCheckedAt: new Date(),
                    manualSafetyOverride: true  // Flag to prevent auto-scan from changing
                }
            },
            { new: true }
        );

        // CRITICAL: Invalidate cache immediately so blocking takes effect
        invalidateCache(url.shortId);
        if (url.customAlias) {
            invalidateCache(url.customAlias);
        }

        logger.info(`[Admin Safety Override] Link ${url.shortId}: ${previousStatus} -> ${safetyStatus} by Admin ${req.user?.email}`);

        res.json({
            message: `Safety status updated to ${safetyStatus}`,
            url: updatedUrl,
            previousStatus
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Re-scan single link for safety
// @route   POST /api/admin/links/:linkId/rescan
// @access  Admin
export const rescanLinkSafety = async (req, res) => {
    try {
        // Security: Validate ObjectId format to prevent injection
        if (!mongoose.Types.ObjectId.isValid(req.params.linkId)) {
            return res.status(400).json({ message: 'Invalid link ID format' });
        }

        const url = await Url.findById(req.params.linkId);
        if (!url) {
            return res.status(404).json({ message: 'URL not found' });
        }

        // Collect all URLs to check (original + device redirects + time redirects)
        const urlsToCheck = [url.originalUrl];

        if (url.deviceRedirects?.enabled && url.deviceRedirects.rules) {
            url.deviceRedirects.rules.forEach(r => {
                if (r.url) urlsToCheck.push(r.url);
            });
        }

        if (url.timeRedirects?.enabled && url.timeRedirects.rules) {
            url.timeRedirects.rules.forEach(r => {
                if (r.destination) urlsToCheck.push(r.destination);
            });
        }

        // Call Safe Browsing API
        const safetyResult = await checkUrlsSafety(urlsToCheck);

        // Update the URL with the result
        const updatedUrl = await Url.findByIdAndUpdate(
            req.params.linkId,
            {
                $set: {
                    safetyStatus: safetyResult.status,
                    safetyDetails: safetyResult.details,
                    lastCheckedAt: new Date(),
                    manualSafetyOverride: false  // Clear override flag since this is a fresh scan
                }
            },
            { new: true }
        );

        // Invalidate cache
        invalidateCache(url.shortId);
        if (url.customAlias) {
            invalidateCache(url.customAlias);
        }

        logger.info(`[Admin Re-Scan] Link ${url.shortId}: Now ${safetyResult.status}`);

        res.json({
            message: `Scan complete: ${safetyResult.status}`,
            url: updatedUrl,
            scanResult: safetyResult
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
