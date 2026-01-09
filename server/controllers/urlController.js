import Url from '../models/Url.js';
import User from '../models/User.js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { invalidateCache } from '../services/cacheService.js';
import { isReservedWord } from '../config/reservedWords.js';
import { incrementLinkUsage } from '../middleware/subscriptionMiddleware.js';
import { hasFeature } from '../services/subscriptionService.js';
import { getDeviceRedirectUrl } from '../services/deviceDetector.js';
import { trackVisit } from '../services/analyticsService.js';

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

// Normalize URL - add https:// if missing
const normalizeUrl = (input) => {
    if (!input) return '';
    const trimmed = input.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
        return `https://${trimmed}`;
    }
    return trimmed;
};

// Check if URL points to our own domain (circular redirect prevention)
const isCircularRedirect = (url) => {
    try {
        const targetHost = new URL(url).hostname.toLowerCase();
        const ownHost = (process.env.CLIENT_URL || process.env.BASE_URL || 'localhost')
            .replace(/^https?:\/\//, '')
            .replace(/\/.*$/, '')
            .toLowerCase();
        return targetHost === ownHost || targetHost.endsWith(`.${ownHost}`);
    } catch {
        return false;
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
    // Schedule Activation (Free feature)
    activeStartTime: z.string().datetime().optional().or(z.null()),
    // Time-Based Redirects (Pro/Business)
    timeRedirects: z.object({
        enabled: z.boolean().default(false),
        timezone: z.string().default('UTC'),
        rules: z.array(z.object({
            startTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM format"),
            endTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM format"),
            days: z.array(z.number().min(0).max(6)).default([]),
            destination: z.string().url({ message: "Invalid destination URL" }).refine((url) => /^https?:\/\//i.test(url), {
                message: "Destination URLs must be HTTP or HTTPS",
            }),
            priority: z.number().default(0),
            label: z.string().optional()
        })).max(50, "Maximum 50 schedule rules allowed").default([]),
    }).optional(),
    // Device-Based Redirects (Pro/Business)
    deviceRedirects: z.object({
        enabled: z.boolean().default(false),
        rules: z.array(z.object({
            device: z.enum(['ios', 'android', 'mobile', 'desktop', 'tablet']),
            url: z.string().url({ message: "Invalid device redirect URL" }).refine((url) => /^https?:\/\//i.test(url), {
                message: "Device redirect URLs must be HTTP or HTTPS",
            }),
            priority: z.number().default(0)
        })).max(50, "Maximum 50 device rules allowed").default([]),
    }).optional(),
});

// @desc    Create Short URL
// @route   POST /api/url/shorten
// @access  Public/Private
const createShortUrl = async (req, res, next) => {
    try {
        // Normalize URL: Prepend https:// if missing (User Experience)
        // Normalize URL: Prepend https:// if missing (User Experience)
        if (req.body.originalUrl && typeof req.body.originalUrl === 'string' && !/^https?:\/\//i.test(req.body.originalUrl)) {
            req.body.originalUrl = `https://${req.body.originalUrl}`;
        }

        // Normalize Device Redirect URLs: Prepend https:// if missing
        if (req.body.deviceRedirects?.rules && Array.isArray(req.body.deviceRedirects.rules)) {
            req.body.deviceRedirects.rules.forEach(rule => {
                if (rule.url && typeof rule.url === 'string' && !/^https?:\/\//i.test(rule.url)) {
                    rule.url = `https://${rule.url}`;
                }
            });
        }

        // Security: Zod strips unknown fields and validates types, preventing NoSQL injection via req.body
        const result = createUrlSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400);
            const errorMessage = result.error?.errors?.[0]?.message || 'Invalid request data';
            throw new Error(errorMessage);
        }

        const { originalUrl, customAlias, title, expiresIn, expiresAt, password } = result.data;
        const userId = req.user ? req.user._id : null;

        // Check Feature: Custom Alias
        if (customAlias) {
             if (req.user && !hasFeature(req.user, 'custom_alias')) {
                 res.status(403);
                 throw new Error('Custom aliases are available on Pro plan');
             }
             if (!req.user && customAlias) {
                  // For public/anon users? Usually not allowed or limited.
                  // Assuming anon users cannot make custom aliases in this system based on plans
                  res.status(403);
                  throw new Error('Sign up to use custom aliases');
             }

            // Reserved words check using centralized config
            if (isReservedWord(customAlias)) {
                res.status(400);
                throw new Error('This alias is reserved and cannot be used');
            }
        }

       // Check Feature: Expiration
       if (expiresIn || expiresAt) {
            if (req.user && !hasFeature(req.user, 'link_expiration')) {
                 res.status(403);
                 throw new Error('Link expiration is available on Pro plan');
            }
       }

        // Auto-generate title from domain if not provided
        const autoTitle = title || extractDomain(originalUrl) || 'Untitled Link';

        // Calculate expiration date
        let finalExpiresAt = null;

        if (!req.user) {
            // Enforce 7-day expiry for anonymous users
            finalExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        } else if (expiresAt) {
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
            if (req.user && !hasFeature(req.user, 'password_protection')) {
                 res.status(403);
                 throw new Error('Password protection is available on Pro plan');
            }
            const salt = await bcrypt.genSalt(10);
            passwordHash = await bcrypt.hash(password, salt);
            isPasswordProtected = true;
        }

        // Handle device redirects (Pro/Business only)
        let deviceRedirectsData = null;
        if (result.data.deviceRedirects?.enabled) {
            // Check subscription tier AND status using hasFeature
            if (!req.user) {
                res.status(403);
                throw new Error('Device targeting requires an account');
            }
            if (!hasFeature(req.user, 'device_targeting')) {
                res.status(403);
                throw new Error('Device targeting is a Pro/Business feature');
            }
            
            // Normalize and validate device redirect URLs
            const processedRules = result.data.deviceRedirects.rules.map(rule => ({
                ...rule,
                url: normalizeUrl(rule.url)
            }));
            
            // Check for circular redirects
            const circularUrls = processedRules.filter(rule => isCircularRedirect(rule.url));
            if (circularUrls.length > 0) {
                res.status(400);
                throw new Error('Device redirect URLs cannot point to this service (circular redirect)');
            }
            
            deviceRedirectsData = {
                ...result.data.deviceRedirects,
                rules: processedRules
            };
        }

        // Handle Time-Based Redirects (Pro/Business only)
        let timeRedirectsData = null;
        if (result.data.timeRedirects?.enabled) {
            if (!req.user) {
                res.status(403);
                throw new Error('Time routing requires an account');
            }
            if (!hasFeature(req.user, 'time_redirects')) {
                res.status(403);
                throw new Error('Time routing is a Pro/Business feature');
            }
            
            // Normalize destination URLs
            const processedRules = result.data.timeRedirects.rules.map(rule => ({
                ...rule,
                destination: normalizeUrl(rule.destination)
            }));
            
            // Check for circular redirects
            const circularUrls = processedRules.filter(rule => isCircularRedirect(rule.destination));
            if (circularUrls.length > 0) {
                res.status(400);
                throw new Error('Time redirect URLs cannot point to this service (circular redirect)');
            }
            
            timeRedirectsData = {
                ...result.data.timeRedirects,
                rules: processedRules
            };
        }

        // Handle activeStartTime (Schedule Activation - Free feature)
        let activeStartTimeData = null;
        if (result.data.activeStartTime) {
            activeStartTimeData = new Date(result.data.activeStartTime);
            if (activeStartTimeData <= new Date()) {
                res.status(400);
                throw new Error('Schedule activation time must be in the future');
            }
        }

        const newUrl = await Url.create({
            originalUrl,
            customAlias: customAlias || undefined,
            title: autoTitle,
            createdBy: userId,
            expiresAt: finalExpiresAt,
            isPasswordProtected,
            passwordHash,
            deviceRedirects: deviceRedirectsData,
            activeStartTime: activeStartTimeData,
            timeRedirects: timeRedirectsData,
        });

        // Return without passwordHash (already excluded by select: false)
        // Increment usage for registered users
        if (req.user) {
            await incrementLinkUsage(req.user._id);
        }

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
    // Schedule Activation (Free feature)
    activeStartTime: z.string().datetime().optional().or(z.null()),
    removeActiveStartTime: z.boolean().optional(),
    // Time-Based Redirects (Pro/Business)
    timeRedirects: z.object({
        enabled: z.boolean().default(false),
        timezone: z.string().default('UTC'),
        rules: z.array(z.object({
            startTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM format"),
            endTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM format"),
            days: z.array(z.number().min(0).max(6)).default([]),
            destination: z.string().url({ message: "Invalid destination URL" }).refine((url) => /^https?:\/\//i.test(url), {
                message: "Destination URLs must be HTTP or HTTPS",
            }),
            priority: z.number().default(0),
            label: z.string().optional()
        })).max(50, "Maximum 50 schedule rules allowed").default([]),
    }).optional(),
    // Device-Based Redirects (Pro/Business)
    deviceRedirects: z.object({
        enabled: z.boolean().default(false),
        rules: z.array(z.object({
            device: z.enum(['ios', 'android', 'mobile', 'desktop', 'tablet']),
            url: z.string().url({ message: "Invalid device redirect URL" }).refine((url) => /^https?:\/\//i.test(url), {
                message: "Device redirect URLs must be HTTP or HTTPS",
            }),
            priority: z.number().default(0)
        })).max(50, "Maximum 50 device rules allowed").default([]),
    }).optional(),
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
        // Normalize URL if provided
        if (req.body.originalUrl && typeof req.body.originalUrl === 'string' && !/^https?:\/\//i.test(req.body.originalUrl)) {
            req.body.originalUrl = `https://${req.body.originalUrl}`;
        }

        // Normalize Device Redirect URLs for update
        if (req.body.deviceRedirects?.rules && Array.isArray(req.body.deviceRedirects.rules)) {
            req.body.deviceRedirects.rules.forEach(rule => {
                if (rule.url && typeof rule.url === 'string' && !/^https?:\/\//i.test(rule.url)) {
                    rule.url = `https://${rule.url}`;
                }
            });
        }
        
        const result = updateUrlSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400);
            const errorMessage = result.error?.errors?.[0]?.message || 'Invalid request data';
            throw new Error(errorMessage);
        }

        const { originalUrl, customAlias, title, expiresIn, expiresAt, removeExpiration, password, removePassword } = result.data;

        // Build update object for atomic operation
        const updateFields = {};
        const unsetFields = {};
        
        // Handle custom alias changes
        if (customAlias !== undefined && customAlias !== null && customAlias !== '') {
            // Check feature access for custom alias
            if (!hasFeature(req.user, 'custom_alias')) {
                res.status(403);
                throw new Error('Custom aliases are available on Pro plan');
            }
            
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
            // Check feature access for expiration
            if (!hasFeature(req.user, 'link_expiration')) {
                res.status(403);
                throw new Error('Link expiration is available on Pro plan');
            }
            const newExpiresAt = new Date(expiresAt);
            if (newExpiresAt <= new Date()) {
                res.status(400);
                throw new Error('Expiration date must be in the future');
            }
            updateFields.expiresAt = newExpiresAt;
            invalidateCache(url.shortId);
            if (url.customAlias) invalidateCache(url.customAlias);
        } else if (expiresIn) {
            // Check feature access for expiration
            if (!hasFeature(req.user, 'link_expiration')) {
                res.status(403);
                throw new Error('Link expiration is available on Pro plan');
            }
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
            // Check feature access for password protection
            if (!hasFeature(req.user, 'password_protection')) {
                res.status(403);
                throw new Error('Password protection is available on Pro plan');
            }
            const salt = await bcrypt.genSalt(10);
            updateFields.passwordHash = await bcrypt.hash(password, salt);
            updateFields.isPasswordProtected = true;
            invalidateCache(url.shortId);
            if (url.customAlias) invalidateCache(url.customAlias);
        }

        // Handle device redirects (Pro/Business only)
        const { deviceRedirects, timeRedirects, activeStartTime, removeActiveStartTime } = result.data;
        if (deviceRedirects !== undefined) {
            if (deviceRedirects?.enabled) {
                // Check subscription tier AND status using hasFeature
                if (!hasFeature(req.user, 'device_targeting')) {
                    res.status(403);
                    throw new Error('Device targeting is a Pro/Business feature');
                }
                
                // Normalize and validate device redirect URLs
                const processedRules = deviceRedirects.rules.map(rule => ({
                    ...rule,
                    url: normalizeUrl(rule.url)
                }));
                
                // Check for circular redirects
                const circularUrls = processedRules.filter(rule => isCircularRedirect(rule.url));
                if (circularUrls.length > 0) {
                    res.status(400);
                    throw new Error('Device redirect URLs cannot point to this service (circular redirect)');
                }
                
                updateFields.deviceRedirects = {
                    ...deviceRedirects,
                    rules: processedRules
                };
            } else {
                // Device redirects disabled - just save as-is
                updateFields.deviceRedirects = deviceRedirects;
            }
            // Invalidate cache when device rules change
            invalidateCache(url.shortId);
            if (url.customAlias) invalidateCache(url.customAlias);
        }

        // Handle activeStartTime (Schedule Activation - Free feature)
        if (removeActiveStartTime) {
            unsetFields.activeStartTime = 1;
            invalidateCache(url.shortId);
            if (url.customAlias) invalidateCache(url.customAlias);
        } else if (activeStartTime) {
            const newActiveStartTime = new Date(activeStartTime);
            if (newActiveStartTime <= new Date()) {
                res.status(400);
                throw new Error('Schedule activation time must be in the future');
            }
            updateFields.activeStartTime = newActiveStartTime;
            invalidateCache(url.shortId);
            if (url.customAlias) invalidateCache(url.customAlias);
        }

        // Handle Time-Based Redirects (Pro/Business only)
        if (timeRedirects !== undefined) {
            if (timeRedirects?.enabled) {
                // Check subscription tier AND status using hasFeature
                if (!hasFeature(req.user, 'time_redirects')) {
                    res.status(403);
                    throw new Error('Time routing is a Pro/Business feature');
                }
                
                // Normalize destination URLs
                const processedRules = timeRedirects.rules.map(rule => ({
                    ...rule,
                    destination: normalizeUrl(rule.destination)
                }));
                
                // Check for circular redirects
                const circularUrls = processedRules.filter(rule => isCircularRedirect(rule.destination));
                if (circularUrls.length > 0) {
                    res.status(400);
                    throw new Error('Time redirect URLs cannot point to this service (circular redirect)');
                }
                
                updateFields.timeRedirects = {
                    ...timeRedirects,
                    rules: processedRules
                };
            } else {
                // Time redirects disabled - just save as-is
                updateFields.timeRedirects = timeRedirects;
            }
            // Invalidate cache when time rules change
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

        // Check Time-Based Redirect first (Pro feature)
        // Import getTimeBasedDestination at top if not already
        let finalTargetUrl = null;
        if (url.timeRedirects?.enabled && url.createdBy) {
            // Check if owner has time_redirects feature
            const owner = await User.findById(url.createdBy).select('subscription role');
            if (owner && (owner.role === 'admin' || hasFeature(owner, 'time_redirects'))) {
                const { getTimeBasedDestination } = await import('../services/timeService.js');
                const timeDestination = getTimeBasedDestination(url.timeRedirects);
                if (timeDestination) {
                    finalTargetUrl = timeDestination;
                    trackVisit(url._id, req, { deviceMatchType: 'time_redirect' });
                }
            }
        }

        // If no time-based match, apply device-based redirect
        if (!finalTargetUrl) {
            const { targetUrl, deviceMatchType } = getDeviceRedirectUrl(url, req.headers['user-agent']);
            finalTargetUrl = targetUrl;
            trackVisit(url._id, req, { deviceMatchType });
        }

        // Return the final URL (time-based, device-specific, or original)
        res.json({
            success: true,
            originalUrl: finalTargetUrl,
            shortId: url.shortId
        });
    } catch (error) {
        next(error);
    }
};

export { createShortUrl, getMyLinks, deleteUrl, checkAliasAvailability, updateUrl, verifyLinkPassword };
