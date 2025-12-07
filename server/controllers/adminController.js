import User from '../models/User.js';
import Url from '../models/Url.js';
import Analytics from '../models/Analytics.js';
import Settings from '../models/Settings.js';
import BanHistory from '../models/BanHistory.js';
import Appeal from '../models/Appeal.js';
import { getCacheStats, clearCache, invalidateMultiple } from '../services/cacheService.js';
import sendEmail from '../utils/sendEmail.js';
import { suspensionEmail, reactivationEmail, appealDecisionEmail, testEmail } from '../utils/emailTemplates.js';

// Helper function to calculate ban expiry date
const calculateBanExpiry = (duration) => {
    if (!duration || duration === 'permanent') return null;

    const now = new Date();
    switch (duration) {
        case '1h':
            return new Date(now.getTime() + 60 * 60 * 1000);
        case '24h':
            return new Date(now.getTime() + 24 * 60 * 60 * 1000);
        case '7d':
            return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        case '30d':
            return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        default:
            return null;
    }
};

// Helper function to send ban/unban notification email
const sendBanNotificationEmail = async (user, isBanned, reason, bannedUntil) => {
    try {
        const settings = await Settings.findOne();
        if (!settings?.emailConfigured) {
            console.log('Email not configured, skipping ban notification');
            return;
        }

        let emailContent;
        if (isBanned) {
            emailContent = suspensionEmail(user, reason, bannedUntil);
        } else {
            emailContent = reactivationEmail(user);
        }

        await sendEmail({
            email: user.email,
            subject: emailContent.subject,
            message: emailContent.html
        });
    } catch (error) {
        console.error('Failed to send ban notification email:', error.message);
    }
};

// @desc    Get system stats
// @route   GET /api/admin/stats
// @access  Admin
export const getSystemStats = async (req, res, next) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalUrls = await Url.countDocuments();
        const totalClicks = await Analytics.countDocuments();

        // Get recent users (last 5)
        const recentUsers = await User.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('-password -refreshTokens');

        // Get cache stats
        const cacheStats = getCacheStats();

        res.json({
            totalUsers,
            totalUrls,
            totalClicks,
            recentUsers,
            cacheStats
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Admin
export const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find()
            .select('-password -refreshTokens')
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        next(error);
    }
};

// @desc    Update user status (Ban/Unban)
// @route   PATCH /api/admin/users/:id/status
// @access  Admin
export const updateUserStatus = async (req, res, next) => {
    try {
        const { reason, disableLinks, reenableLinks, duration } = req.body || {};
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent banning self
        if (user._id.toString() === req.user.id) {
            return res.status(400).json({ message: 'Cannot ban your own admin account' });
        }

        // Prevent admin-to-admin bans
        if (user.role === 'admin' && !user.isActive === false) {
            // User is active and is an admin, we're trying to ban them
            return res.status(400).json({ message: 'Cannot ban another admin. Demote them first.' });
        }

        const wasBanned = !user.isActive;
        user.isActive = !user.isActive;

        let bannedUntil = null;

        if (!user.isActive) {
            // Banning user
            user.bannedAt = new Date();
            user.bannedReason = reason || 'Account suspended by administrator';
            user.bannedBy = req.user.id;

            // Handle temporary ban duration
            bannedUntil = calculateBanExpiry(duration);
            user.bannedUntil = bannedUntil;

            // Configure whether links should be disabled
            if (typeof disableLinks === 'boolean') {
                user.disableLinksOnBan = disableLinks;
            }
            // Immediately invalidate all refresh tokens
            user.refreshTokens = [];

            // Log ban history
            await BanHistory.create({
                userId: user._id,
                action: duration && duration !== 'permanent' ? 'ban' : 'ban',
                reason: user.bannedReason,
                duration: duration || 'permanent',
                bannedUntil,
                linksAffected: disableLinks || false,
                performedBy: req.user.id,
                ipAddress: req.ip || req.connection?.remoteAddress
            });

            // Send ban notification email
            sendBanNotificationEmail(user, true, reason, bannedUntil);
        } else {
            // Unbanning user - use undefined instead of null to unset the fields
            user.bannedAt = undefined;
            user.bannedReason = undefined;
            user.bannedUntil = undefined;
            user.bannedBy = undefined;

            // If admin chose to re-enable links, reset the disableLinksOnBan flag
            if (reenableLinks === true) {
                user.disableLinksOnBan = false;
            }

            // Log unban history
            await BanHistory.create({
                userId: user._id,
                action: 'unban',
                reason: 'Manually unbanned by administrator',
                linksAffected: reenableLinks || false,
                performedBy: req.user.id,
                ipAddress: req.ip || req.connection?.remoteAddress
            });

            // Send unban notification email
            sendBanNotificationEmail(user, false);
        }

        await user.save();

        // Invalidate cache for all user's links when ban status changes
        // This ensures redirects reflect the new ban status immediately
        // Include both shortId and customAlias for complete cache invalidation
        const userUrls = await Url.find({ createdBy: user._id }).select('shortId customAlias');
        if (userUrls.length > 0) {
            const allIds = [];
            userUrls.forEach(u => {
                allIds.push(u.shortId);
                if (u.customAlias) {
                    allIds.push(u.customAlias);
                }
            });
            invalidateMultiple(allIds);
        }

        res.json({
            message: `User ${user.isActive ? 'activated' : 'banned'}${bannedUntil ? ` until ${bannedUntil.toLocaleString()}` : ''}`,
            user: {
                _id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                isActive: user.isActive,
                bannedAt: user.bannedAt,
                bannedReason: user.bannedReason,
                bannedUntil: user.bannedUntil,
                disableLinksOnBan: user.disableLinksOnBan,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update user role (Promote/Demote)
// @route   PATCH /api/admin/users/:id/role
// @access  Admin
export const updateUserRole = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent changing own role
        if (user._id.toString() === req.user.id) {
            return res.status(400).json({ message: 'Cannot change your own role' });
        }

        // Toggle role between 'user' and 'admin'
        user.role = user.role === 'admin' ? 'user' : 'admin';
        await user.save();

        res.json({
            message: `User ${user.role === 'admin' ? 'promoted to admin' : 'demoted to user'}`,
            user: {
                _id: user._id,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Admin
export const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent deleting self
        if (user._id.toString() === req.user.id) {
            return res.status(400).json({ message: 'Cannot delete your own admin account' });
        }

        // Find all URLs by this user
        const userUrls = await Url.find({ user: user._id });
        const urlIds = userUrls.map(url => url._id);

        // Delete all analytics for these URLs
        await Analytics.deleteMany({ urlId: { $in: urlIds } });

        // Delete all URLs
        await Url.deleteMany({ user: user._id });

        // Delete the user
        await User.findByIdAndDelete(req.params.id);

        res.json({ message: 'User and associated data removed' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get system settings
// @route   GET /api/admin/settings
// @access  Admin
export const getSettings = async (req, res, next) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }

        // Return settings with masked password
        const settingsObj = settings.toObject();
        settingsObj.emailPassword = settings.emailPassword ? '••••••••' : '';

        res.json(settingsObj);
    } catch (error) {
        next(error);
    }
};

// @desc    Update system settings
// @route   PATCH /api/admin/settings
// @access  Admin
export const updateSettings = async (req, res, next) => {
    try {
        console.log('[updateSettings] Request received:', JSON.stringify(req.body, null, 2));

        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }

        const {
            requireEmailVerification,
            emailProvider,
            emailUsername,
            emailPassword,
            smtpHost,
            smtpPort,
            smtpSecure
        } = req.body;

        if (requireEmailVerification !== undefined) {
            settings.requireEmailVerification = requireEmailVerification;
        }

        if (emailProvider !== undefined) {
            settings.emailProvider = emailProvider;
        }

        if (emailUsername !== undefined) {
            settings.emailUsername = emailUsername;
        }

        // Only update password if a new one is provided (not the masked version)
        if (emailPassword && emailPassword !== '••••••••') {
            settings.emailPassword = emailPassword;
        }

        // Custom SMTP settings
        if (smtpHost !== undefined) {
            settings.smtpHost = smtpHost;
        }

        if (smtpPort !== undefined) {
            settings.smtpPort = smtpPort;
        }

        if (smtpSecure !== undefined) {
            settings.smtpSecure = smtpSecure;
        }

        console.log('[updateSettings] Saving settings...');
        await settings.save();
        console.log('[updateSettings] Settings saved successfully!');

        // Return settings with masked password
        const settingsObj = settings.toObject();
        settingsObj.emailPassword = settings.emailPassword ? '••••••••' : '';

        res.json(settingsObj);
    } catch (error) {
        next(error);
    }
};

// @desc    Test email configuration
// @route   POST /api/admin/settings/test-email
// @access  Admin
export const testEmailConfiguration = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Please provide an email address to test' });
        }

        const settings = await Settings.findOne();

        if (!settings || !settings.emailConfigured) {
            return res.status(400).json({ message: 'Email is not configured yet' });
        }

        const sendEmailUtil = (await import('../utils/sendEmail.js')).default;
        const emailContent = testEmail();

        await sendEmailUtil({
            email,
            subject: emailContent.subject,
            message: emailContent.html,
        });

        res.json({ message: 'Test email sent successfully!' });
    } catch (error) {
        next(error);
    }
};

// @desc    Clear URL cache
// @route   POST /api/admin/cache/clear
// @access  Admin
export const clearUrlCache = async (req, res, next) => {
    try {
        clearCache();
        res.json({ message: 'Cache cleared successfully', stats: getCacheStats() });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new user (admin created)
// @route   POST /api/admin/users
// @access  Admin
export const createUser = async (req, res, next) => {
    try {
        const { email, password, role, firstName, lastName, phone, company, website } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Validate role
        const validRoles = ['user', 'admin'];
        const userRole = validRoles.includes(role) ? role : 'user';

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Validate password strength
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        // Create user - password will be hashed by pre-save hook
        const user = await User.create({
            email: email.toLowerCase(),
            password,
            role: userRole,
            firstName,
            lastName,
            phone,
            company,
            website,
            isVerified: true, // Admin-created users are auto-verified
            isActive: true
        });

        // Return user without sensitive data
        res.status(201).json({
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            company: user.company,
            role: user.role,
            isVerified: user.isVerified,
            isActive: user.isActive,
            createdAt: user.createdAt
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get ban history for a user
// @route   GET /api/admin/users/:id/ban-history
// @access  Admin
export const getUserBanHistory = async (req, res, next) => {
    try {
        const userId = req.params.id;

        const history = await BanHistory.find({ userId })
            .populate('performedBy', 'email firstName lastName')
            .sort({ createdAt: -1 })
            .limit(50);

        res.json(history);
    } catch (error) {
        next(error);
    }
};

// @desc    Get appeals for a user
// @route   GET /api/admin/users/:id/appeals
// @access  Admin
export const getUserAppeals = async (req, res, next) => {
    try {
        const userId = req.params.id;

        const appeals = await Appeal.find({ userId })
            .populate('reviewedBy', 'email firstName lastName')
            .sort({ createdAt: -1 });

        res.json(appeals);
    } catch (error) {
        next(error);
    }
};

// @desc    Get all pending appeals
// @route   GET /api/admin/appeals
// @access  Admin
export const getAllAppeals = async (req, res, next) => {
    try {
        const { status } = req.query;
        const filter = status ? { status } : {};

        const appeals = await Appeal.find(filter)
            .populate('userId', 'email firstName lastName bannedAt bannedReason')
            .populate('reviewedBy', 'email firstName lastName')
            .sort({ createdAt: -1 });

        res.json(appeals);
    } catch (error) {
        next(error);
    }
};

// @desc    Respond to an appeal
// @route   PATCH /api/admin/appeals/:id
// @access  Admin
export const respondToAppeal = async (req, res, next) => {
    try {
        const { status, adminResponse, unbanUser } = req.body;

        if (!status || !['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Valid status (approved/rejected) is required' });
        }

        const appeal = await Appeal.findById(req.params.id);

        if (!appeal) {
            return res.status(404).json({ message: 'Appeal not found' });
        }

        if (appeal.status !== 'pending') {
            return res.status(400).json({ message: 'This appeal has already been reviewed' });
        }

        appeal.status = status;
        appeal.adminResponse = adminResponse || null;
        appeal.reviewedBy = req.user.id;
        appeal.reviewedAt = new Date();

        await appeal.save();

        // If approved and unbanUser is true, unban the user
        if (status === 'approved') {
            const user = await User.findById(appeal.userId);
            if (user && !user.isActive) {
                if (unbanUser) {
                    user.isActive = true;
                    user.bannedAt = undefined;
                    user.bannedReason = undefined;
                    user.bannedUntil = undefined;
                    user.bannedBy = undefined;
                    user.disableLinksOnBan = false;
                    await user.save();

                    // Log in ban history
                    await BanHistory.create({
                        userId: user._id,
                        action: 'unban',
                        reason: `Appeal approved: ${adminResponse || 'No additional comments'}`,
                        linksAffected: true,
                        performedBy: req.user.id,
                        ipAddress: req.ip || req.connection?.remoteAddress
                    });

                    // Invalidate cache for user's links
                    const userUrls = await Url.find({ createdBy: user._id }).select('shortId customAlias');
                    if (userUrls.length > 0) {
                        const allIds = [];
                        userUrls.forEach(u => {
                            allIds.push(u.shortId);
                            if (u.customAlias) allIds.push(u.customAlias);
                        });
                        invalidateMultiple(allIds);
                    }

                    // Send notification email
                    sendBanNotificationEmail(user, false);
                } else {
                    // Appeal approved but NOT unbanned immediately
                    // Mark user as "Unban Pending"
                    user.bannedReason = `Appeal Approved - Unban Pending. ${adminResponse || ''}`;
                    await user.save();

                    // Log in ban history
                    await BanHistory.create({
                        userId: user._id,
                        action: 'appeal_approved',
                        reason: `Appeal approved (Unban Pending): ${adminResponse || 'No additional comments'}`,
                        linksAffected: false,
                        performedBy: req.user.id,
                        ipAddress: req.ip || req.connection?.remoteAddress
                    });
                }
            }
        }

        // Send appeal decision email
        try {
            const settings = await Settings.findOne();
            if (settings?.emailConfigured) {
                const user = await User.findById(appeal.userId);
                if (user) {
                    const emailContent = appealDecisionEmail(user, status, adminResponse, unbanUser);

                    await sendEmail({
                        email: user.email,
                        subject: emailContent.subject,
                        message: emailContent.html
                    });
                }
            }
        } catch (emailError) {
            console.error('Failed to send appeal decision email:', emailError.message);
        }

        const populatedAppeal = await Appeal.findById(appeal._id)
            .populate('userId', 'email firstName lastName')
            .populate('reviewedBy', 'email firstName lastName');

        res.json({
            message: `Appeal ${status}`,
            appeal: populatedAppeal
        });
    } catch (error) {
        next(error);
    }
};
