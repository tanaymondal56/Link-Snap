import { scanPendingLinks, scanUncheckedLinks } from './safeBrowsingService.js';
import { processExpiredSubscriptions } from './subscriptionService.js';
import { processExpiredBans, processScheduledChangelogs } from './banScheduler.js';
import logger from '../utils/logger.js';
import { getRedisClient } from '../config/redis.js';

// Intervals
const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

let safetyScanInterval = null;
let backlogScanInterval = null;
let subscriptionSweepInterval = null;

// Start all background jobs
export const startCronJobs = () => {
    if (safetyScanInterval) return; // Already running

    logger.info('[Cron] Starting background jobs...');

    // 1. Safe Browsing Retry Worker
    // Retries 'pending' checks that failed during real-time creation
    let isScanning = false;
    safetyScanInterval = setInterval(async () => {
        if (isScanning) return;
        
        const redis = getRedisClient();
        if (redis) {
            // Lock for 270 seconds (4.5 minutes) to cover the 5-minute interval
            const acquired = await redis.set('ls:lock:cron:safety', '1', { nx: true, ex: 270 });
            if (!acquired) {
                return;
            }
        }

        isScanning = true;
        try {
            await scanPendingLinks();
        } catch (err) {
            logger.error(`[Cron] Safety scan error: ${err.message}`);
        } finally {
            isScanning = false;
        }
    }, FIVE_MINUTES).unref();
    
    logger.info('[Cron] Safe Browsing retry worker started (Every 5 mins)');

    // 2. Backlog Scanner (Unchecked Links)
    // Catches links that were missed or skipped (bulk imports, system downtime)
    backlogScanInterval = setInterval(async () => {
        const redis = getRedisClient();
        if (redis) {
            // Lock for 3300 seconds (55 minutes) to cover the 1-hour interval
            const acquired = await redis.set('ls:lock:cron:backlog', '1', { nx: true, ex: 3300 });
            if (!acquired) {
                return;
            }
        }

        try {
            await scanUncheckedLinks();
        } catch (err) {
            logger.error(`[Cron] Backlog scan error: ${err.message}`);
        }
    }, ONE_HOUR).unref();
    logger.info('[Cron] Safe Browsing backlog scanner started (Every 1 hour)');

    // 3. Subscription & Ban Expiration Worker
    // Automatically sweeps expired subscriptions, temporary bans, and publishes scheduled changelogs
    subscriptionSweepInterval = setInterval(async () => {
        const redis = getRedisClient();
        if (redis) {
            // Lock for 3300 seconds (55 minutes) to prevent duplicate runs across multi-container clusters
            const acquired = await redis.set('ls:lock:cron:subs_bans', '1', { nx: true, ex: 3300 });
            if (!acquired) {
                return;
            }
        }

        try {
            await processExpiredSubscriptions();
            await processExpiredBans();
            await processScheduledChangelogs();
        } catch (err) {
            logger.error(`[Cron] Subscription/Ban sweep error: ${err.message}`);
        }
    }, ONE_HOUR).unref();
    logger.info('[Cron] Subscription & Ban lifecycle worker started (Every 1 hour)');
};

// Stop jobs (for graceful shutdown)
export const stopCronJobs = () => {
    if (safetyScanInterval) {
        clearInterval(safetyScanInterval);
        safetyScanInterval = null;
    }
    if (backlogScanInterval) {
        clearInterval(backlogScanInterval);
        backlogScanInterval = null;
    }
    if (subscriptionSweepInterval) {
        clearInterval(subscriptionSweepInterval);
        subscriptionSweepInterval = null;
    }
    logger.info('[Cron] All background jobs stopped.');
};
