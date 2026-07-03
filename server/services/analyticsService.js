import Analytics from '../models/Analytics.js';
import { UAParser } from 'ua-parser-js';
import geoip from 'geoip-lite';
import { getUserIP } from '../middleware/strictProxyGate.js';
import { getRedisClient } from '../config/redis.js';

// Buffer configuration
const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 5000; // 5 seconds
let isFlushing = false;
let analyticsBuffer = []; // Fallback for single-pod mode
let flushTimer = null;

const REDIS_QUEUE_KEY = 'ls:analytics:queue';

const flushBuffer = async () => {
    if (isFlushing) return;
    isFlushing = true;

    const redis = getRedisClient();
    const bufferToInsert = [];

    try {
        if (redis) {
            // Atomic fetch and clear using multi/exec or LTRIM
            // We use LRANGE to get all items, then LTRIM to remove them
            const items = await redis.lrange(REDIS_QUEUE_KEY, 0, -1);
            if (items && items.length > 0) {
                // Remove the items we just fetched
                await redis.ltrim(REDIS_QUEUE_KEY, items.length, -1);
                
                for (const item of items) {
                    try {
                        bufferToInsert.push(JSON.parse(item));
                    } catch (e) {
                        console.error('[Analytics] Failed to parse queued item:', e);
                    }
                }
            }
        } else {
            if (analyticsBuffer.length > 0) {
                bufferToInsert.push(...analyticsBuffer);
                analyticsBuffer = []; // Clear local buffer immediately
            }
        }

        if (bufferToInsert.length > 0) {
            await Analytics.insertMany(bufferToInsert, { ordered: false });
        }
    } catch (error) {
        console.error('[Analytics] Flush Error:', error);
        // On error, if we wanted to retry we could LPUSH them back, but for analytics dropping them on DB failure is usually acceptable.
    } finally {
        isFlushing = false;
    }
};

// Start the flush timer
const startFlushTimer = () => {
    if (!flushTimer) {
        flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL);
    }
};

startFlushTimer();

export const trackVisit = async (urlId, req, extras = {}) => {
    try {
        // Security: Truncate to prevent ReDoS
        const rawUA = req.headers['user-agent'] || '';
        const userAgent = rawUA.substring(0, 500);
        
        const parser = new UAParser(userAgent);
        const browser = parser.getBrowser();
        const os = parser.getOS();
        const device = parser.getDevice();

        // Get real user IP using proxy-aware extraction
        const ip = getUserIP(req);

        // GeoIP lookup
        const geo = geoip.lookup(ip);

        const analyticsData = {
            urlId,
            ip,
            userAgent: req.headers['user-agent'],
            browser: browser.name || 'Unknown',
            os: os.name || 'Unknown',
            device: device.type ? (device.type.charAt(0).toUpperCase() + device.type.slice(1)) : 'Desktop',
            country: geo ? geo.country : 'Unknown',
            city: geo ? geo.city : 'Unknown',
            deviceMatchType: extras.deviceMatchType || null,
        };

        const redis = getRedisClient();
        
        if (redis) {
            // Push to Redis queue
            const length = await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(analyticsData));
            if (length >= BATCH_SIZE && !isFlushing) {
                clearInterval(flushTimer);
                await flushBuffer();
                flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL);
            }
        } else {
            // Fallback to memory
            analyticsBuffer.push(analyticsData);
            if (analyticsBuffer.length >= BATCH_SIZE && !isFlushing) {
                clearInterval(flushTimer);
                await flushBuffer();
                flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL);
            }
        }

    } catch (error) {
        console.error('Analytics Tracking Error:', error);
    }
};

/**
 * Flush all pending analytics records to DB and stop the timer.
 * Call this during graceful shutdown to prevent data loss.
 */
export const flushAnalyticsAndStop = async () => {
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
    }
    await flushBuffer();
};
