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

        // Use cursor to stream expired bans instead of loading all into memory
        const cursor = User.find({
            isActive: false,
            bannedUntil: { $lte: now, $ne: null }
        }).cursor();

        const CONCURRENCY_LIMIT = 20; // Process 20 users in parallel
        let userBatch = [];

        for (let user = await cursor.next(); user != null; user = await cursor.next()) {
            userBatch.push(user);

            if (userBatch.length >= CONCURRENCY_LIMIT) {
                await Promise.all(userBatch.map(processSingleUnban));
                userBatch = [];
            }
        }

        // Process remaining users
        if (userBatch.length > 0) {
            await Promise.all(userBatch.map(processSingleUnban));
        }

    } catch (error) {
        logger.error(`Error processing expired bans: ${error.message}`);
    }
};

// Helper function to process a single user unban
const processSingleUnban = async (user) => {
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
            userInternalId: user.internalId,
            action: 'temp_ban_expired',
            reason: 'Temporary ban period expired - automatically unbanned',
            linksAffected: true,
            // performedBy omitted to indicate system action
        });

        // Invalidate cache for user's links - Optimized with Cursor
        const urlCursor = Url.find({ createdBy: user._id })
            .select('shortId customAlias')
            .cursor();

        let batchIds = [];
        const CACHE_BATCH_SIZE = 500;

        for (let doc = await urlCursor.next(); doc != null; doc = await urlCursor.next()) {
            batchIds.push(doc.shortId);
            if (doc.customAlias) {
                batchIds.push(doc.customAlias);
            }

            if (batchIds.length >= CACHE_BATCH_SIZE) {
                invalidateMultiple(batchIds);
                batchIds = [];
            }
        }

        if (batchIds.length > 0) {
            invalidateMultiple(batchIds);
        }

        // Send reactivation email
        sendBanExpiredEmail(user);

        logger.info(`Auto-unbanned user ${user.email} after temporary ban expired`);
    } catch (error) {
        logger.error(`Failed to auto-unban user ${user.email}: ${error.message}`);
    }
};

// Start the scheduler (runs every minute)
const startBanScheduler = () => {
    logger.info('Starting temporary ban scheduler');

    // Run immediately on start
    processExpiredBans();
    processScheduledChangelogs();

    // Flag to prevent overlapping runs if processing takes > 1 minute
    let isSchedulerRunning = false;

    // Then run every minute
    setInterval(async () => {
        if (isSchedulerRunning) return;
        isSchedulerRunning = true;
        
        try {
            await processExpiredBans();
            await processScheduledChangelogs();
        } catch (err) {
            logger.error(`[BanScheduler] Error in optimized loop: ${err.message}`);
        } finally {
            isSchedulerRunning = false;
        }
    }, 60 * 1000);
};

export { startBanScheduler, processExpiredBans, processScheduledChangelogs };
