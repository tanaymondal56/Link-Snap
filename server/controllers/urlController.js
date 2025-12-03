import Url from '../models/Url.js';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { invalidateCache } from '../services/cacheService.js';
import { isReservedWord } from '../config/reservedWords.js';

// Extract domain from URL (safe - no network request)
const extractDomain = (url) => {
    try {
        const { hostname } = new URL(url);
        // Remove 'www.' prefix if present
        return hostname.replace(/^www\./i, '');
    } catch {
        return null;
    }
};

// Validation Schema
const createUrlSchema = z.object({
    // Security: Enforce HTTP/HTTPS to prevent javascript: XSS attacks
    originalUrl: z.string().url({ message: "Invalid URL format" }).refine((url) => /^https?:\/\//i.test(url), {
        message: "Only HTTP and HTTPS URLs are allowed",
    }),
    customAlias: z.string().min(3).max(20).regex(/^[a-zA-Z0-9-_]+$/, "Alias must be alphanumeric").optional().or(z.literal('')),
    title: z.string().optional(),
});

// @desc    Create Short URL
// @route   POST /api/url/shorten
// @access  Public/Private
const createShortUrl = async (req, res, next) => {
    try {
        // Normalize URL: Prepend https:// if missing (User Experience)
        if (req.body.originalUrl && typeof req.body.originalUrl === 'string' && !/^https?:\/\//i.test(req.body.originalUrl)) {
            req.body.originalUrl = `https://${req.body.originalUrl}`;
        }

        // Security: Zod strips unknown fields and validates types, preventing NoSQL injection via req.body
        const result = createUrlSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400);
            throw new Error(result.error.errors[0].message);
        }

        const { originalUrl, customAlias, title } = result.data;
        const userId = req.user ? req.user._id : null;

        // Reserved words check using centralized config
        if (customAlias && isReservedWord(customAlias)) {
            res.status(400);
            throw new Error('This alias is reserved and cannot be used');
        }

        // Check if custom alias exists
        if (customAlias) {
            const aliasExists = await Url.findOne({
                $or: [{ shortId: customAlias }, { customAlias: customAlias }]
            });
            if (aliasExists) {
                res.status(400);
                throw new Error('Alias already taken');
            }
        }

        // Always generate a random shortId (even if customAlias is provided)
        const shortId = nanoid(8);

        // Auto-generate title from domain if not provided
        const autoTitle = title || extractDomain(originalUrl) || 'Untitled Link';

        const newUrl = await Url.create({
            originalUrl,
            shortId: shortId,
            customAlias: customAlias || undefined,
            title: autoTitle,
            createdBy: userId,
        });

        res.status(201).json(newUrl);
    } catch (error) {
        next(error);
    }
};

// @desc    Get My Links
// @route   GET /api/url/my-links
// @access  Private
const getMyLinks = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const urls = await Url.find({ createdBy: req.user._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Url.countDocuments({ createdBy: req.user._id });

        // Note: Banned users cannot reach this endpoint (blocked by authMiddleware)
        // So ownerBanned will always be false here. This field exists for consistency
        // with admin endpoint and future use if auth policy changes.
        const urlsWithBanStatus = urls.map(url => {
            const urlObj = url.toObject();
            urlObj.ownerBanned = false;
            return urlObj;
        });

        res.json({
            urls: urlsWithBanStatus,
            ownerBanned: false,
            page,
            pages: Math.ceil(total / limit),
            total,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete Link
// @route   DELETE /api/url/:id
// @access  Private
const deleteUrl = async (req, res, next) => {
    try {
        const url = await Url.findById(req.params.id);

        if (!url) {
            res.status(404);
            throw new Error('URL not found');
        }

        if (url.createdBy.toString() !== req.user._id.toString()) {
            res.status(401);
            throw new Error('Not authorized');
        }

        // Invalidate cache before deleting
        invalidateCache(url.shortId);
        if (url.customAlias) {
            invalidateCache(url.customAlias);
        }

        await url.deleteOne();
        res.json({ message: 'URL removed' });
    } catch (error) {
        next(error);
    }
};

// @desc    Check Alias Availability
// @route   GET /api/url/check-alias/:alias
// @access  Private (logged-in users only)
const checkAliasAvailability = async (req, res, next) => {
    try {
        const { alias } = req.params;
        const { excludeId } = req.query; // For edit mode - exclude current link

        // Validate alias format
        if (!alias || alias.length < 3) {
            return res.json({
                available: false,
                reason: 'Alias must be at least 3 characters'
            });
        }

        if (alias.length > 20) {
            return res.json({
                available: false,
                reason: 'Alias must be 20 characters or less'
            });
        }

        if (!/^[a-zA-Z0-9-_]+$/.test(alias)) {
            return res.json({
                available: false,
                reason: 'Only letters, numbers, hyphens and underscores allowed'
            });
        }

        // Check reserved words
        if (isReservedWord(alias)) {
            return res.json({
                available: false,
                reason: 'This alias is reserved'
            });
        }

        // Check if alias exists in database (excluding current link if editing)
        const query = {
            $or: [{ shortId: alias }, { customAlias: alias }]
        };

        if (excludeId) {
            query._id = { $ne: excludeId };
        }

        const existingUrl = await Url.findOne(query);

        if (existingUrl) {
            return res.json({
                available: false,
                reason: 'This alias is already taken'
            });
        }

        res.json({
            available: true,
            reason: null
        });
    } catch (error) {
        next(error);
    }
};

// Validation Schema for Update
const updateUrlSchema = z.object({
    originalUrl: z.string().url({ message: "Invalid URL format" }).refine((url) => /^https?:\/\//i.test(url), {
        message: "Only HTTP and HTTPS URLs are allowed",
    }).optional(),
    customAlias: z.string().min(3).max(20).regex(/^[a-zA-Z0-9-_]+$/, "Alias must be alphanumeric").optional().or(z.literal('')).or(z.null()),
    title: z.string().optional(),
});

// @desc    Update Link
// @route   PUT /api/url/:id
// @access  Private
const updateUrl = async (req, res, next) => {
    try {
        const url = await Url.findById(req.params.id);

        if (!url) {
            res.status(404);
            throw new Error('URL not found');
        }

        if (url.createdBy.toString() !== req.user._id.toString()) {
            res.status(401);
            throw new Error('Not authorized');
        }

        // Normalize URL if provided
        if (req.body.originalUrl && typeof req.body.originalUrl === 'string' && !/^https?:\/\//i.test(req.body.originalUrl)) {
            req.body.originalUrl = `https://${req.body.originalUrl}`;
        }

        const result = updateUrlSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400);
            throw new Error(result.error.errors[0].message);
        }

        const { originalUrl, customAlias, title } = result.data;

        // If customAlias is being set/changed
        if (customAlias !== undefined && customAlias !== null && customAlias !== '') {
            // Reserved words check
            if (isReservedWord(customAlias)) {
                res.status(400);
                throw new Error('This alias is reserved and cannot be used');
            }

            // Check if alias is taken (excluding current link)
            const aliasExists = await Url.findOne({
                $or: [{ shortId: customAlias }, { customAlias: customAlias }],
                _id: { $ne: url._id }
            });
            if (aliasExists) {
                res.status(400);
                throw new Error('Alias already taken');
            }

            url.customAlias = customAlias;
        } else if (customAlias === '' || customAlias === null) {
            // Remove custom alias if empty string or null is passed
            url.customAlias = undefined;
        }

        // Update other fields if provided
        if (originalUrl) {
            // Invalidate old cache
            invalidateCache(url.shortId);
            if (url.customAlias) {
                invalidateCache(url.customAlias);
            }
            url.originalUrl = originalUrl;
        }

        if (title !== undefined) {
            url.title = title || extractDomain(url.originalUrl) || 'Untitled Link';
        }

        await url.save();

        res.json(url);
    } catch (error) {
        next(error);
    }
};

export { createShortUrl, getMyLinks, deleteUrl, checkAliasAvailability, updateUrl };
