import mongoose from 'mongoose';
import User from '../models/User.js';
import Url from '../models/Url.js';
import Analytics from '../models/Analytics.js';
import Settings from '../models/Settings.js';
import BanHistory from '../models/BanHistory.js';
import Appeal from '../models/Appeal.js';
import Feedback from '../models/Feedback.js';
import UsernameHistory from '../models/UsernameHistory.js';
import { getCacheStats, clearCache, invalidateMultiple } from '../services/cacheService.js';
import sendEmail from '../utils/sendEmail.js';
import { suspensionEmail, reactivationEmail, appealDecisionEmail, testEmail } from '../utils/emailTemplates.js';
import { escapeRegex } from '../utils/regexUtils.js';
import { generateUserIdentity } from '../services/idService.js';

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
        const totalUsers = await User.countDocuments(); // Accurate count for users (usually smaller collection)
        const totalUrls = await Url.estimatedDocumentCount(); // Fast estimate for large collection
        const totalClicks = await Analytics.estimatedDocumentCount(); // Fast estimate for very large collection

        // Get recent users (last 5) - fetch without sort, sort in JS (Cosmos DB index workaround)
        let recentUsers = await User.find()
            .limit(50) // Fetch more, then sort and slice in JS
            .select('-password -refreshTokens');
        
        // Sort in JavaScript (Cosmos DB doesn't have createdAt index)
        recentUsers = recentUsers
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);

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

// @desc    Get all users (paginated, searchable)
// @route   GET /api/admin/users
// @access  Admin
export const getAllUsers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const role = req.query.role || '';
        const skip = (page - 1) * limit;

        const query = {};
        const tier = req.query.tier || '';

        // Search logic
        if (search) {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$or = [
                { email: { $regex: escapedSearch, $options: 'i' } },
                { firstName: { $regex: escapedSearch, $options: 'i' } },
                { lastName: { $regex: escapedSearch, $options: 'i' } },
                { username: { $regex: escapedSearch, $options: 'i' } }
            ];
        }

        // Role filtering
        if (role && role !== 'all') {
            query.role = role;
        }

        // Tier filtering
        if (tier && tier !== 'all') {
            if (tier === 'paid') {
                query['subscription.tier'] = { $in: ['pro', 'business'] };
            } else {
                query['subscription.tier'] = tier;
            }
        }

        // Execute query without sort (Cosmos DB index workaround)
        let users = await User.find(query)
            .select('-password -refreshTokens')
            .limit(limit + skip); // Fetch enough for pagination
        
        // Sort in JavaScript
        users = users
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(skip, skip + limit);

        const total = await User.countDocuments(query);

        res.json({
            users,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
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
        const user = await User.findById(req.params.userId);

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
        const newIsActive = !user.isActive;

        let bannedUntil = null;

        if (!newIsActive) {
            // Banning user - use atomic operation
            bannedUntil = calculateBanExpiry(duration);
            const banReason = reason || 'Account suspended by administrator';
            
            await User.findByIdAndUpdate(
                user._id,
                {
                    $set: {
                        isActive: false,
                        bannedAt: new Date(),
                        bannedReason: banReason,
                        bannedBy: req.user.id,
                        bannedUntil: bannedUntil,
                        ...(typeof disableLinks === 'boolean' && { disableLinksOnBan: disableLinks }),
                        refreshTokens: [] // Invalidate all tokens
                    }
                }
            );

            // Log ban history
            await BanHistory.create({
                userId: user._id,
                userInternalId: user.internalId,
                action: duration && duration !== 'permanent' ? 'ban' : 'ban',
                reason: banReason,
                duration: duration || 'permanent',
                bannedUntil,
                linksAffected: disableLinks || false,
                performedBy: req.user.id,
                ipAddress: req.ip || req.connection?.remoteAddress
            });

            // Send ban notification email (pass user object for email data)
            sendBanNotificationEmail(user, true, reason, bannedUntil);
        } else {
            // Unbanning user - use atomic operation
            const updateOps = {
                $set: { isActive: true },
                $unset: { bannedAt: 1, bannedReason: 1, bannedUntil: 1, bannedBy: 1 }
            };
            
            if (reenableLinks === true) {
                updateOps.$set.disableLinksOnBan = false;
            }
            
            await User.findByIdAndUpdate(user._id, updateOps);

            // Log unban history
            await BanHistory.create({
                userId: user._id,
                userInternalId: user.internalId,
                action: 'unban',
                reason: 'Manually unbanned by administrator',
                linksAffected: reenableLinks || false,
                performedBy: req.user.id,
                ipAddress: req.ip || req.connection?.remoteAddress
            });

            // Send unban notification email
            sendBanNotificationEmail(user, false);
        }

        // Update local user object for response (refetch to get latest state)
        const updatedUser = await User.findById(user._id);

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
            message: `User ${updatedUser.isActive ? 'activated' : 'banned'}${bannedUntil ? ` until ${bannedUntil.toLocaleString()}` : ''}`,
            user: {
                _id: updatedUser._id,
                email: updatedUser.email,
                firstName: updatedUser.firstName,
                lastName: updatedUser.lastName,
                role: updatedUser.role,
                isActive: updatedUser.isActive,
                bannedAt: updatedUser.bannedAt,
                bannedReason: updatedUser.bannedReason,
                bannedUntil: updatedUser.bannedUntil,
                disableLinksOnBan: updatedUser.disableLinksOnBan,
                createdAt: updatedUser.createdAt
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
        const user = await User.findById(req.params.userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent changing own role
        if (user._id.toString() === req.user.id) {
            return res.status(400).json({ message: 'Cannot change your own role' });
        }

        // Toggle role between 'user' and 'admin' using atomic operation
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { $set: { role: newRole } },
            { new: true }
        );

        res.json({
            message: `User ${newRole === 'admin' ? 'promoted to admin' : 'demoted to user'}`,
            user: {
                _id: updatedUser._id,
                email: updatedUser.email,
                role: updatedUser.role,
                isActive: updatedUser.isActive,
                createdAt: updatedUser.createdAt
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
        const user = await User.findById(req.params.userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent deleting self
        if (user._id.toString() === req.user.id) {
            return res.status(400).json({ message: 'Cannot delete your own admin account' });
        }

        // Cancel Lemon Squeezy subscription if exists
        if (user.subscription?.subscriptionId && process.env.LEMONSQUEEZY_API_KEY) {
            try {
                const axios = (await import('axios')).default;
                await axios.delete(
                    `https://api.lemonsqueezy.com/v1/subscriptions/${user.subscription.subscriptionId}`,
                    {
                        headers: {
                            'Accept': 'application/vnd.api+json',
                            'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`
                        }
                    }
                );
                console.log(`[Delete User] Cancelled LS subscription for ${user.snapId}`);
            } catch (lsError) {
                // Log but don't block deletion - subscription may already be cancelled
                console.warn(`[Delete User] Failed to cancel LS subscription: ${lsError.message}`);
            }
        }

        // Find all URLs by this user
        const userUrls = await Url.find({ createdBy: user._id });
        const userIds = userUrls.map(url => url._id);

        // Delete all analytics for these URLs
        await Analytics.deleteMany({ urlId: { $in: userIds } });

        // Delete all URLs
        await Url.deleteMany({ createdBy: user._id });

        // Delete the user
        await User.findByIdAndDelete(req.params.userId);

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
        const { email, password, role, firstName, lastName, phone, company, website, username } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Validate role
        const validRoles = ['user', 'admin'];
        const userRole = validRoles.includes(role) ? role : 'user';

        // Check if user already exists by email
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Handle username - either validate provided or generate
        let finalUsername;
        if (username) {
            // Validate provided username
            const usernameLower = username.toLowerCase().trim();
            
            if (usernameLower.length < 3 || usernameLower.length > 30) {
                return res.status(400).json({ message: 'Username must be 3-30 characters' });
            }
            
            if (!/^[a-z0-9_-]+$/.test(usernameLower)) {
                return res.status(400).json({ message: 'Username can only contain lowercase letters, numbers, underscores, and dashes' });
            }
            
            // Check reserved words (import at top of file)
            const { isReservedWord } = await import('../config/reservedWords.js');
            if (isReservedWord(usernameLower)) {
                return res.status(400).json({ message: 'This username is not available' });
            }
            
            // Check if username already exists
            const existingUsername = await User.findOne({ username: usernameLower });
            if (existingUsername) {
                return res.status(400).json({ message: 'Username is already taken' });
            }
            
            finalUsername = usernameLower;
        } else {
            // Auto-generate username from email (before @)
            const emailPrefix = email.toLowerCase().split('@')[0].replace(/[^a-z0-9_-]/g, '').slice(0, 20);
            let generatedUsername = emailPrefix;
            let counter = 1;
            
            // Ensure uniqueness
            while (await User.findOne({ username: generatedUsername })) {
                generatedUsername = `${emailPrefix}${counter}`;
                counter++;
                if (counter > 100) {
                    // Fallback to random suffix
                    generatedUsername = `${emailPrefix}${Date.now().toString(36)}`;
                    break;
                }
            }
            finalUsername = generatedUsername;
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long' });
        }

        // Generate Elite ID based on role
        // generateEliteId is deprecated wrapper, using generateUserIdentity
        const isAdminRole = userRole === 'admin';
        const eliteIdData = await generateUserIdentity(isAdminRole);

        // Create user - password will be hashed by pre-save hook
        const user = await User.create({
            email: email.toLowerCase(),
            username: finalUsername,
            password,
            role: userRole,
            firstName,
            lastName,
            phone,
            company,
            website,
            isVerified: true, // Admin-created users are auto-verified
            isActive: true,
            // Identity system
            eliteId: eliteIdData.eliteId,
            snapId: eliteIdData.snapId,
            idTier: eliteIdData.idTier,
            idNumber: eliteIdData.idNumber,
        });

        // Return user without sensitive data
        res.status(201).json({
            _id: user._id,
            email: user.email,
            username: user.username,
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
        const userId = req.params.userId;

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
        const userId = req.params.userId;

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

        const appeal = await Appeal.findById(req.params.appealId);

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

        // Atomic update for appeal
        await Appeal.findByIdAndUpdate(appeal._id, {
            $set: {
                status: status,
                adminResponse: adminResponse || null,
                reviewedBy: req.user.id,
                reviewedAt: new Date()
            }
        });

        // If approved and unbanUser is true, unban the user
        if (status === 'approved') {
            const user = await User.findById(appeal.userId);
            if (user && !user.isActive) {
                if (unbanUser) {
                    // Atomic unban operation
                    await User.findByIdAndUpdate(user._id, {
                        $set: { isActive: true, disableLinksOnBan: false },
                        $unset: { bannedAt: 1, bannedReason: 1, bannedUntil: 1, bannedBy: 1 }
                    });

                    // Log in ban history
                    await BanHistory.create({
                        userId: user._id,
                        userInternalId: user.internalId,
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
                    // Mark user as "Unban Pending" using atomic update
                    await User.findByIdAndUpdate(user._id, {
                        $set: { bannedReason: `Appeal Approved - Unban Pending. ${adminResponse || ''}` }
                    });

                    // Log in ban history
                    await BanHistory.create({
                        userId: user._id,
                        userInternalId: user.internalId,
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

// ============================================
// FEEDBACK MANAGEMENT
// ============================================

// Helper to escape regex special characters (prevents ReDoS attacks)
// Moved to utils/regexUtils.js

// @desc    Export feedback to CSV
// @route   GET /api/admin/feedback/export
// @access  Admin
export const exportFeedbackCSV = async (req, res, next) => {
    try {
        const feedback = await Feedback.find({ isDeleted: false })
            .populate('user', 'email username firstName lastName')
            .sort({ createdAt: -1 })
            .lean();

        // CSV Header
        const headers = ['ID', 'Type', 'Status', 'Priority', 'Title', 'Message', 'Votes', 'User Email', 'Category', 'Created At'];
        
        // Transform data to CSV rows
        const rows = feedback.map(item => {
            const userEmail = item.email || item.user?.email || 'Anonymous';
            // Escape quotes in text fields to prevent CSV breakage
            const safeTitle = `"${(item.title || '').replace(/"/g, '""')}"`;
            const safeMessage = `"${(item.message || '').replace(/"/g, '""')}"`;
            
            return [
                item._id,
                item.type,
                item.status,
                item.priority,
                safeTitle,
                safeMessage,
                item.voteCount,
                userEmail,
                item.category,
                new Date(item.createdAt).toISOString()
            ].join(',');
        });

        // Combine header and rows
        const csvString = [headers.join(','), ...rows].join('\n');

        // Set headers for download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=feedback_export_${new Date().toISOString().split('T')[0]}.csv`);
        
        res.status(200).send(csvString);
    } catch (error) {
        next(error);
    }
};

// @desc    Get all feedback (paginated, filterable)
// @route   GET /api/admin/feedback
// @access  Admin
export const getAllFeedback = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        
        // Build filter
        const filter = { isDeleted: false };
        
        if (req.query.type && req.query.type !== 'all') {
            filter.type = req.query.type;
        }
        if (req.query.status && req.query.status !== 'all') {
            if (req.query.status === 'active') {
                filter.status = { $nin: ['completed', 'declined'] };
            } else if (req.query.status === 'resolved') {
                filter.status = { $in: ['completed', 'declined'] };
            } else {
                filter.status = req.query.status;
            }
        }
        if (req.query.priority && req.query.priority !== 'all') {
            filter.priority = req.query.priority;
        }
        if (req.query.search) {
            // Escape special regex characters to prevent ReDoS
            const searchRegex = new RegExp(escapeRegex(req.query.search), 'i');
            filter.$or = [
                { title: searchRegex },
                { message: searchRegex },
                { email: searchRegex }
            ];
        }
        
        // Sort options
        let sortOption = {};
        if (req.query.sort === 'votes') {
            sortOption = { voteCount: -1, createdAt: -1 };
        } else if (req.query.sort === 'oldest') {
            sortOption = { createdAt: 1 };
        } else {
            sortOption = { createdAt: -1 };
        }
        
        const [feedback, total] = await Promise.all([
            Feedback.find(filter)
                .populate('user', 'email username firstName lastName')
                .sort(sortOption)
                .skip(skip)
                .limit(limit)
                .lean(), // Optimization: Return plain JS objects
            Feedback.countDocuments(filter)
        ]);
        
        res.json({
            feedback,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get feedback statistics
// @route   GET /api/admin/feedback/stats
// @access  Admin
export const getFeedbackStats = async (req, res, next) => {
    try {
        const [
            total,
            newCount,
            byType,
            byStatus,
            topVoted
        ] = await Promise.all([
            Feedback.countDocuments({ isDeleted: false }),
            Feedback.countDocuments({ isDeleted: false, status: 'new' }),
            Feedback.aggregate([
                { $match: { isDeleted: false } },
                { $group: { _id: '$type', count: { $sum: 1 } } }
            ]),
            Feedback.aggregate([
                { $match: { isDeleted: false } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Feedback.find({ isDeleted: false })
                .sort({ voteCount: -1 })
                .limit(5)
                .select('title type voteCount status')
        ]);
        
        // Convert aggregation results to objects
        const typeStats = {};
        byType.forEach(t => { typeStats[t._id] = t.count; });
        
        const statusStats = {};
        byStatus.forEach(s => { statusStats[s._id] = s.count; });
        
        res.json({
            total,
            new: newCount,
            byType: typeStats,
            byStatus: statusStats,
            topVoted
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update feedback (status, priority, notes)
// @route   PATCH /api/admin/feedback/:id
// @access  Admin
export const updateFeedback = async (req, res, next) => {
    try {
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid feedback ID' });
        }
        
        const { status, priority, adminNotes, category } = req.body;
        
        // Validate adminNotes length
        if (adminNotes && adminNotes.length > 5000) {
            return res.status(400).json({ message: 'Admin notes cannot exceed 5000 characters' });
        }
        
        const feedback = await Feedback.findById(req.params.id);
        
        if (!feedback || feedback.isDeleted) {
            return res.status(404).json({ message: 'Feedback not found' });
        }
        
        // Validate status if provided
        const validStatuses = ['new', 'under_review', 'planned', 'in_progress', 'completed', 'declined'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }
        
        // Validate priority if provided
        const validPriorities = ['low', 'medium', 'high', 'critical'];
        if (priority && !validPriorities.includes(priority)) {
            return res.status(400).json({ message: 'Invalid priority' });
        }
        
        // Update fields if provided
        if (status) feedback.status = status;
        if (priority) feedback.priority = priority;
        if (adminNotes !== undefined) feedback.adminNotes = adminNotes;
        if (category) feedback.category = category;
        
        await feedback.save();
        
        // Populate user for response
        await feedback.populate('user', 'email username firstName lastName');
        
        res.json({
            message: 'Feedback updated',
            feedback
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete feedback (soft delete)
// @route   DELETE /api/admin/feedback/:id
// @access  Admin
export const deleteFeedback = async (req, res, next) => {
    try {
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid feedback ID' });
        }
        
        const feedback = await Feedback.findById(req.params.id);
        
        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }
        
        // Soft delete
        feedback.isDeleted = true;
        await feedback.save();
        
        res.json({ message: 'Feedback deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get username history for a user
// @route   GET /api/admin/users/:userId/username-history
// @access  Admin
export const getUsernameHistory = async (req, res, next) => {
    try {
        const { userId } = req.params;

        // Verify user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const history = await UsernameHistory.find({ userId })
            .populate('changedBy', 'email firstName lastName')
            .sort({ changedAt: -1 })
            .limit(50)
            .lean();

        res.json({
            currentUsername: user.username,
            usernameChangedAt: user.usernameChangedAt,
            history
        });
    } catch (error) {
        next(error);
    }
};
