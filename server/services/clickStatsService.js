import Url from '../models/Url.js';
import User from '../models/User.js';

// Buffer configuration
const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 5000; // 5 seconds
let clickBuffer = new Map(); // Map<urlId, count>
let userClickBuffer = new Map(); // Map<userId, count>
let flushTimer = null;
let isFlushing = false;

/**
 * Flushes the buffered click counts to the database using bulkWrite
 */
const flushBuffer = async () => {
    if ((clickBuffer.size === 0 && userClickBuffer.size === 0) || isFlushing) return;

    isFlushing = true;

    // --- Process URL Clicks ---
    const urlOps = [];
    if (clickBuffer.size > 0) {
        const urlBufferToProcess = new Map(clickBuffer);
        clickBuffer.clear();

        for (const [urlId, count] of urlBufferToProcess) {
            urlOps.push({
                updateOne: {
                    filter: { _id: urlId },
                    update: { $inc: { clicks: count } }
                }
            });
        }
    }

    // --- Process User Clicks ---
    const userOps = [];
    if (userClickBuffer.size > 0) {
        const userBufferToProcess = new Map(userClickBuffer);
        userClickBuffer.clear();

        for (const [userId, count] of userBufferToProcess) {
            userOps.push({
                updateOne: {
                    filter: { _id: userId },
                    update: { $inc: { 'clickUsage.count': count } }
                }
            });
        }
    }

    // --- Execute Bulk Writes ---
    try {
        const promises = [];
        if (urlOps.length > 0) {
            promises.push(Url.bulkWrite(urlOps, { ordered: false }));
        }
        if (userOps.length > 0) {
            promises.push(User.bulkWrite(userOps, { ordered: false }));
        }
        
        await Promise.all(promises);
    } catch (error) {
        console.error('[ClickStats] Flush Error:', error);
    } finally {
        isFlushing = false;
    }
};

/**
 * Starts the flush timer
 */
const startFlushTimer = () => {
    if (!flushTimer) {
        flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL);
        // Ensure graceful shutdown
        process.on('SIGTERM', async () => {
            await flushBuffer();
            process.exit(0);
        });
    }
};

startFlushTimer();

/**
 * Queues a click increment for a specific URL
 * @param {string} urlId - The MongoDB _id of the URL
 */
export const queueClickIncrement = async (urlId) => {
    try {
        const idStr = urlId.toString();
        const currentCheck = clickBuffer.get(idStr) || 0;
        clickBuffer.set(idStr, currentCheck + 1);

        // Immediate flush if buffer gets too large
        if (clickBuffer.size >= BATCH_SIZE) {
            if (!isFlushing) {
                // Reset timer only if we actually trigger the flush
                clearInterval(flushTimer);
                await flushBuffer();
                flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL);
            }
        }
    } catch (error) {
        console.error('[ClickStats] Queue Error:', error);
    }
};

/**
 * Queues a click increment for a specific User
 * @param {string} userId - The MongoDB _id of the User
 */
export const queueUserClickIncrement = async (userId) => {
    try {
        const idStr = userId.toString();
        const current = userClickBuffer.get(idStr) || 0;
        userClickBuffer.set(idStr, current + 1);

        if (userClickBuffer.size >= BATCH_SIZE) {
            clearInterval(flushTimer);
            await flushBuffer();
            flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL);
        }
    } catch (error) {
        console.error('[ClickStats] User Queue Error:', error);
    }
};
