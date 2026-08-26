import Analytics from '../models/Analytics.js';
import { UAParser } from 'ua-parser-js';
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

    try {
        if (redis) {
            let drainedBatches = 0;
            const MAX_DRAIN_BATCHES = 10; // Drain up to 1,000 items per flush tick

            while (drainedBatches < MAX_DRAIN_BATCHES) {
                const items = await redis.lpop(REDIS_QUEUE_KEY, BATCH_SIZE);
                if (!items || items.length === 0) break;

                const bufferToInsert = [];
                for (const item of items) {
                    try {
                        bufferToInsert.push(typeof item === 'string' ? JSON.parse(item) : item);
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
                        break;
                    }
                }
                drainedBatches++;
            }
        } else {
            if (analyticsBuffer.length > 0) {
                const bufferToInsert = [...analyticsBuffer];
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

// Start the flush timer (unref to prevent event loop blocking)
const startFlushTimer = () => {
    if (!flushTimer) {
        flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL).unref();
    }
};

startFlushTimer();

const uaCache = new Map();
const MAX_UA_CACHE = 1000;

const parseUserAgent = (ua) => {
    if (!ua) return { browser: 'Unknown', os: 'Unknown', device: 'Desktop' };
    const cached = uaCache.get(ua);
    if (cached) return cached;

    const parser = new UAParser(ua);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();

    const parsed = {
        browser: browser.name || 'Unknown',
        os: os.name || 'Unknown',
        device: device.type ? (device.type.charAt(0).toUpperCase() + device.type.slice(1)) : 'Desktop',
    };

    if (uaCache.size >= MAX_UA_CACHE) {
        const firstKey = uaCache.keys().next().value;
        uaCache.delete(firstKey);
    }
    uaCache.set(ua, parsed);
    return parsed;
};

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

export const trackVisit = async (urlId, req, extras = {}) => {
    try {
        // Security: Truncate to prevent ReDoS
        const rawUA = req.headers['user-agent'] || '';
        const userAgent = rawUA.substring(0, 500);
        
        const { browser, os, device } = parseUserAgent(userAgent);

        // Get real user IP using proxy-aware extraction, then anonymize (GDPR)
        const rawIp = getUserIP(req);
        // Mask the last octet for IPv4 or last 80 bits for IPv6 (GDPR/privacy)
        const ip = rawIp.includes(':') 
          ? rawIp.replace(/(:[0-9a-fA-F]{0,4}){3}$/, ':0:0:0')  // IPv6 anonymize
          : rawIp.replace(/\.\d+$/, '.0');                        // IPv4 anonymize

        // GeoIP lookup - prefer Cloudflare CF-IPCountry header for 0ms CPU lookup
        const cfCountry = req.headers['cf-ipcountry'];
        const cfCity = req.headers['cf-ipcity'];
        
        let resolvedCountry = 'Unknown';
        if (cfCountry && cfCountry !== 'XX') {
            try {
                resolvedCountry = regionNames.of(cfCountry.toUpperCase()) || cfCountry.toUpperCase();
            } catch {
                resolvedCountry = cfCountry.toUpperCase();
            }
        }

        const analyticsData = {
            urlId,
            ip,
            userAgent: userAgent, // Use truncated version (max 500 chars)
            browser,
            os,
            device,
            country: resolvedCountry,
            city: cfCity || 'Unknown',
            deviceMatchType: extras.deviceMatchType || null,
        };

        const redis = getRedisClient();
        
        if (redis) {
            // Push to Redis queue
            const length = await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(analyticsData));
            if (length >= BATCH_SIZE && !isFlushing) {
                flushBuffer();
            }
        } else {
            // Fallback to memory with emergency OOM cap (max 10,000 items)
            if (analyticsBuffer.length < 10000) {
                analyticsBuffer.push(analyticsData);
            }
            if (analyticsBuffer.length >= BATCH_SIZE && !isFlushing) {
                flushBuffer();
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
