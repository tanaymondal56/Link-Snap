import { scanPendingLinks, scanUncheckedLinks } from './safeBrowsingService.js';
import logger from '../utils/logger.js';

// Intervals
const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

let safetyScanInterval = null;
let backlogScanInterval = null;

// Start all background jobs
export const startCronJobs = () => {
    if (safetyScanInterval) return; // Already running

    logger.info('[Cron] Starting background jobs...');

    // 1. Safe Browsing Retry Worker
    // Retries 'pending' checks that failed during real-time creation
    let isScanning = false;
    safetyScanInterval = setInterval(async () => {
        if (isScanning) return;
        isScanning = true;
        try {
            await scanPendingLinks();
        } catch (err) {
            logger.error(`[Cron] Safety scan error: ${err.message}`);
        } finally {
            isScanning = false;
        }
    }, FIVE_MINUTES);
    
    logger.info('[Cron] Safe Browsing retry worker started (Every 5 mins)');

    // 2. Backlog Scanner (Unchecked Links)
    // Catches links that were missed or skipped (bulk imports, system downtime)
    backlogScanInterval = setInterval(async () => {
        try {
            await scanUncheckedLinks();
        } catch (err) {
            logger.error(`[Cron] Backlog scan error: ${err.message}`);
        }
    }, ONE_HOUR);
    logger.info('[Cron] Safe Browsing backlog scanner started (Every 1 hour)');
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
    logger.info('[Cron] All background jobs stopped.');
};
