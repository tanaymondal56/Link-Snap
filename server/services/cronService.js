import { scanPendingLinks } from './safeBrowsingService.js';

// Intervals
const FIVE_MINUTES = 5 * 60 * 1000;

let safetyScanInterval = null;

// Start all background jobs
export const startCronJobs = () => {
    if (safetyScanInterval) return; // Already running

    console.log('[Cron] Starting background jobs...');

    // 1. Safe Browsing Retry Worker
    // Retries 'pending' checks that failed during real-time creation
    let isScanning = false;
    safetyScanInterval = setInterval(async () => {
        if (isScanning) return;
        isScanning = true;
        try {
            await scanPendingLinks();
        } catch (err) {
            console.error('[Cron] Safety scan error:', err.message);
        } finally {
            isScanning = false;
        }
    }, FIVE_MINUTES);
    
    console.log('[Cron] Safe Browsing retry worker started (Every 5 mins)');
};

// Stop jobs (for graceful shutdown)
export const stopCronJobs = () => {
    if (safetyScanInterval) {
        clearInterval(safetyScanInterval);
        safetyScanInterval = null;
        console.log('[Cron] Jobs stopped');
    }
};
