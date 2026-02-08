import Analytics from '../models/Analytics.js';
import { UAParser } from 'ua-parser-js';
import geoip from 'geoip-lite';
import { getUserIP } from '../middleware/strictProxyGate.js';

// Buffer configuration
const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 5000; // 5 seconds
let isFlushing = false;
let analyticsBuffer = [];
let flushTimer = null;

const flushBuffer = async () => {
    if (analyticsBuffer.length === 0 || isFlushing) return;

    isFlushing = true;
    const bufferToInsert = [...analyticsBuffer];
    analyticsBuffer = []; // Clear buffer immediately

    try {
        await Analytics.insertMany(bufferToInsert, { ordered: false });
        // console.log(`[Analytics] Flushed ${bufferToInsert.length} records`);
    } catch (error) {
        console.error('[Analytics] Flush Error:', error);
        // Note: Logic could be added here to retry failed inserts if critical
    } finally {
        isFlushing = false;
    }
};

// Start the flush timer
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
            // ua-parser-js returns undefined for type 'desktop', so we default to 'Desktop'
            device: device.type ? (device.type.charAt(0).toUpperCase() + device.type.slice(1)) : 'Desktop',
            country: geo ? geo.country : 'Unknown',
            city: geo ? geo.city : 'Unknown',
            // Device-based redirect tracking
            deviceMatchType: extras.deviceMatchType || null,
            // Mongoose timestamps won't auto-generate for insertMany unless specified or schema default
            // Schema has timestamps: true, but insertMany bypasses mongoose defaults usually? 
            // Actually, Mongoose 5+ handle defaults in insertMany if model is passed.
            // But let's be safe and rely on DB defaults or schema.
        };

        analyticsBuffer.push(analyticsData);

        // Immediate flush if buffer full
        if (analyticsBuffer.length >= BATCH_SIZE) {
            if (!isFlushing) {
                // Reset timer only if we actually trigger the flush
                clearInterval(flushTimer);
                await flushBuffer();
                flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL);
            }
        }

    } catch (error) {
        console.error('Analytics Tracking Error:', error);
        // We don't throw here to avoid blocking the main flow if analytics fails
    }
};
