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
            // Atomically pop up to BATCH_SIZE items from the queue
            // (Upstash supports LPOP with count argument)
            const items = await redis.lpop(REDIS_QUEUE_KEY, BATCH_SIZE);
            
            if (items && items.length > 0) {
                for (const item of items) {
                    try {
                        bufferToInsert.push(JSON.parse(item));
                    } catch (e) {
                        console.error('[Analytics] Failed to parse queued item:', e);
                    }
                }
                
                if (bufferToInsert.length > 0) {
                    try {
                        await Analytics.insertMany(bufferToInsert, { ordered: false });
                    } catch (dbError) {
                        console.error('[Analytics] DB insert failed. Restoring data to Redis...', dbError.message);
                        // Data safety backup: if DB fails, push the items back to the head of the queue
                        await redis.lpush(REDIS_QUEUE_KEY, ...items);
                    }
                }
            }
        } else {
            if (analyticsBuffer.length > 0) {
                bufferToInsert.push(...analyticsBuffer);
                analyticsBuffer = []; // Clear local buffer immediately
                
                try {
                    await Analytics.insertMany(bufferToInsert, { ordered: false });
                } catch (dbError) {
                    console.error('[Analytics] DB insert failed. Restoring data to memory...', dbError.message);
                    analyticsBuffer.unshift(...bufferToInsert);
                }
            }
        }
    } catch (error) {
        console.error('[Analytics] Flush Error:', error);
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
