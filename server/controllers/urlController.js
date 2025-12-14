import Url from '../models/Url.js';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
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

// Helper to calculate expiration date from preset
const calculateExpiresAt = (expiresIn) => {
    if (!expiresIn || expiresIn === 'never') return null;
    
    const now = new Date();
    switch (expiresIn) {
        case '1h': return new Date(now.getTime() + 60 * 60 * 1000);
        case '24h': return new Date(now.getTime() + 24 * 60 * 60 * 1000);
        case '7d': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        case '30d': return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        default: return null;
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
    // Link Expiration
    expiresIn: z.enum(['never', '1h', '24h', '7d', '30d']).optional(),
    expiresAt: z.string().datetime().optional().or(z.null()),  // ISO date string for custom
    // Password Protection
    password: z.string().min(4, "Password must be at least 4 characters").max(100).optional().or(z.literal('')),
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

        const { originalUrl, customAlias, title, expiresIn, expiresAt, password } = result.data;
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

        // Calculate expiration date
        let finalExpiresAt = null;
        if (expiresAt) {
            // Custom date provided
            finalExpiresAt = new Date(expiresAt);
            if (finalExpiresAt <= new Date()) {
                res.status(400);
                throw new Error('Expiration date must be in the future');
            }
        } else if (expiresIn) {
            // Preset duration
            finalExpiresAt = calculateExpiresAt(expiresIn);
        }

        // Handle password
        let passwordHash = null;
        let isPasswordProtected = false;
        if (password && password.length >= 4) {
            const salt = await bcrypt.genSalt(10);
            passwordHash = await bcrypt.hash(password, salt);
            isPasswordProtected = true;
        }

        const newUrl = await Url.create({
            originalUrl,
            shortId: shortId,
            customAlias: customAlias || undefined,
            title: autoTitle,
            createdBy: userId,
            expiresAt: finalExpiresAt,
            isPasswordProtected,
            passwordHash,
        });

        // Return without passwordHash (already excluded by select: false)
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
    // Link Expiration
    expiresIn: z.enum(['never', '1h', '24h', '7d', '30d']).optional(),
    expiresAt: z.string().datetime().optional().or(z.null()),
    removeExpiration: z.boolean().optional(),
    // Password Protection
    password: z.string().min(4, "Password must be at least 4 characters").max(100).optional().or(z.literal('')),
    removePassword: z.boolean().optional(),
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

        const { originalUrl, customAlias, title, expiresIn, expiresAt, removeExpiration, password, removePassword } = result.data;

        // Build update object for atomic operation
        const updateFields = {};
        const unsetFields = {};
        
        // Handle custom alias changes
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

            updateFields.customAlias = customAlias;
        } else if (customAlias === '' || customAlias === null) {
            // Remove custom alias - use $unset in the update
            unsetFields.customAlias = 1;
        }

        // Update other fields if provided
        if (originalUrl) {
            // Invalidate old cache
            invalidateCache(url.shortId);
            if (url.customAlias) {
                invalidateCache(url.customAlias);
            }
            updateFields.originalUrl = originalUrl;
        }

        if (title !== undefined) {
            updateFields.title = title || extractDomain(url.originalUrl) || 'Untitled Link';
        }

        // Handle expiration changes
        if (removeExpiration) {
            unsetFields.expiresAt = 1;
            // Invalidate cache since expiration changed
            invalidateCache(url.shortId);
            if (url.customAlias) invalidateCache(url.customAlias);
        } else if (expiresAt) {
            const newExpiresAt = new Date(expiresAt);
            if (newExpiresAt <= new Date()) {
                res.status(400);
                throw new Error('Expiration date must be in the future');
            }
            updateFields.expiresAt = newExpiresAt;
            invalidateCache(url.shortId);
            if (url.customAlias) invalidateCache(url.customAlias);
        } else if (expiresIn) {
            updateFields.expiresAt = calculateExpiresAt(expiresIn);
            invalidateCache(url.shortId);
            if (url.customAlias) invalidateCache(url.customAlias);
        }

        // Handle password changes
        if (removePassword) {
            updateFields.isPasswordProtected = false;
            unsetFields.passwordHash = 1;
            invalidateCache(url.shortId);
            if (url.customAlias) invalidateCache(url.customAlias);
        } else if (password && password.length >= 4) {
            const salt = await bcrypt.genSalt(10);
            updateFields.passwordHash = await bcrypt.hash(password, salt);
            updateFields.isPasswordProtected = true;
            invalidateCache(url.shortId);
            if (url.customAlias) invalidateCache(url.customAlias);
        }

        // Build update operation
        const updateOperation = {};
        if (Object.keys(updateFields).length > 0) {
            updateOperation.$set = updateFields;
        }
        if (Object.keys(unsetFields).length > 0) {
            updateOperation.$unset = unsetFields;
        }

        // Atomic update to prevent race conditions
        const updatedUrl = await Url.findByIdAndUpdate(
            url._id,
            updateOperation,
            { new: true }
        );

        res.json(updatedUrl);
    } catch (error) {
        next(error);
    }
};

// @desc    Verify Password for Protected Link
// @route   POST /api/url/:shortId/verify-password
// @access  Public
const verifyLinkPassword = async (req, res, next) => {
    try {
        const { shortId } = req.params;
        const { password } = req.body;

        if (!password) {
            res.status(400);
            throw new Error('Password is required');
        }

        // Find the link by shortId or customAlias, including passwordHash
        const url = await Url.findOne({
            $or: [{ shortId }, { customAlias: shortId }]
        }).select('+passwordHash');

        if (!url) {
            res.status(404);
            throw new Error('Link not found');
        }

        if (!url.isPasswordProtected || !url.passwordHash) {
            res.status(400);
            throw new Error('This link is not password protected');
        }

        // Check if link has expired
        if (url.expiresAt && new Date() > new Date(url.expiresAt)) {
            res.status(410);
            throw new Error('This link has expired');
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, url.passwordHash);

        if (!isMatch) {
            res.status(401);
            throw new Error('Incorrect password');
        }

        // Password correct - increment clicks and track visit
        Url.findByIdAndUpdate(url._id, { $inc: { clicks: 1 } }).exec();

        // Password correct - return the original URL
        res.json({
            success: true,
            originalUrl: url.originalUrl,
            shortId: url.shortId
        });
    } catch (error) {
        next(error);
    }
};

export { createShortUrl, getMyLinks, deleteUrl, checkAliasAvailability, updateUrl, verifyLinkPassword };
