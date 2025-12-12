import User from '../models/User.js';
import BanHistory from '../models/BanHistory.js';
import Settings from '../models/Settings.js';
import Url from '../models/Url.js';
import Changelog from '../models/Changelog.js';
import { invalidateMultiple } from '../services/cacheService.js';
import logger from '../utils/logger.js';
import sendEmail from '../utils/sendEmail.js';
import { reactivationEmail } from '../utils/emailTemplates.js';

// Process scheduled changelog publishing
const processScheduledChangelogs = async () => {
    try {
        const now = new Date();
        
        // Find changelogs scheduled to publish now or earlier
        const scheduled = await Changelog.find({
            isPublished: false,
            scheduledFor: { $lte: now, $ne: null }
        });

        if (scheduled.length === 0) return;

        logger.info(`Publishing ${scheduled.length} scheduled changelog(s)`);

        for (const changelog of scheduled) {
            try {
                changelog.isPublished = true;
                changelog.scheduledFor = null;
                changelog.history.push({
                    action: 'published',
                    timestamp: new Date(),
                    changes: 'Scheduled publish'
                });
                await changelog.save();
                
                logger.info(`Auto-published changelog: ${changelog.version}`);
            } catch (error) {
                logger.error(`Failed to publish scheduled changelog ${changelog.version}: ${error.message}`);
            }
        }
    } catch (error) {
        logger.error(`Error processing scheduled changelogs: ${error.message}`);
    }
};

// Send reactivation email when temporary ban expires
const sendBanExpiredEmail = async (user) => {
    try {
        const settings = await Settings.findOne();
        if (!settings?.emailConfigured) {
            return;
        }

        const emailContent = reactivationEmail(user);
        await sendEmail({
            email: user.email,
            subject: emailContent.subject,
            message: emailContent.html
        });

        logger.info(`Sent reactivation email to ${user.email}`);
    } catch (error) {
        logger.error(`Failed to send reactivation email to ${user.email}: ${error.message}`);
    }
};

// Check and process expired temporary bans
const processExpiredBans = async () => {
    try {
        const now = new Date();

        // Find users with expired temporary bans
        const expiredBans = await User.find({
            isActive: false,
            bannedUntil: { $lte: now, $ne: null }
        });

        if (expiredBans.length === 0) {
            return;
        }

        logger.info(`Processing ${expiredBans.length} expired temporary bans`);

        for (const user of expiredBans) {
            try {
                // Unban the user using atomic operation
                await User.findByIdAndUpdate(
                    user._id,
                    {
                        $set: { isActive: true, disableLinksOnBan: false },
                        $unset: { bannedAt: 1, bannedReason: 1, bannedUntil: 1, bannedBy: 1 }
                    }
                );

                // Log in ban history
                await BanHistory.create({
                    userId: user._id,
                    action: 'temp_ban_expired',
                    reason: 'Temporary ban period expired - automatically unbanned',
                    linksAffected: true,
                    // performedBy omitted to indicate system action
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

                // Send reactivation email
                sendBanExpiredEmail(user);

                logger.info(`Auto-unbanned user ${user.email} after temporary ban expired`);
            } catch (error) {
                logger.error(`Failed to auto-unban user ${user.email}: ${error.message}`);
            }
        }
    } catch (error) {
        logger.error(`Error processing expired bans: ${error.message}`);
    }
};

// Start the scheduler (runs every minute)
const startBanScheduler = () => {
    logger.info('Starting temporary ban scheduler');

    // Run immediately on start
    processExpiredBans();
    processScheduledChangelogs();

    // Then run every minute
    setInterval(() => {
        processExpiredBans();
        processScheduledChangelogs();
    }, 60 * 1000);
};

export { startBanScheduler, processExpiredBans, processScheduledChangelogs };
