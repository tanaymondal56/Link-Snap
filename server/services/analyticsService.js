import Analytics from '../models/Analytics.js';
import useragent from 'useragent';
import geoip from 'geoip-lite';

// Buffer configuration
const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 5000; // 5 seconds
let analyticsBuffer = [];
let flushTimer = null;

const flushBuffer = async () => {
    if (analyticsBuffer.length === 0) return;

    const bufferToInsert = [...analyticsBuffer];
    analyticsBuffer = []; // Clear buffer immediately

    try {
        await Analytics.insertMany(bufferToInsert, { ordered: false });
        // console.log(`[Analytics] Flushed ${bufferToInsert.length} records`);
    } catch (error) {
        console.error('[Analytics] Flush Error:', error);
        // Note: Logic could be added here to retry failed inserts if critical
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

export const trackVisit = async (urlId, req) => {
    try {
        const agent = useragent.parse(req.headers['user-agent']);

        // Get IP address (handle proxies)
        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || req.connection.remoteAddress;

        // GeoIP lookup
        const geo = geoip.lookup(ip);

        const analyticsData = {
            urlId,
            ip,
            userAgent: req.headers['user-agent'],
            browser: agent.toAgent(),
            os: agent.os.toString(),
            device: agent.device.toString() !== 'Other 0.0.0' ? agent.device.toString() : 'Desktop', // Simple fallback
            country: geo ? geo.country : 'Unknown',
            city: geo ? geo.city : 'Unknown',
            // Mongoose timestamps won't auto-generate for insertMany unless specified or schema default
            // Schema has timestamps: true, but insertMany bypasses mongoose defaults usually? 
            // Actually, Mongoose 5+ handle defaults in insertMany if model is passed.
            // But let's be safe and rely on DB defaults or schema.
        };

        analyticsBuffer.push(analyticsData);

        // Immediate flush if buffer full
        if (analyticsBuffer.length >= BATCH_SIZE) {
            // Reset timer to avoid double flush
            clearInterval(flushTimer);
            await flushBuffer();
            flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL);
        }

    } catch (error) {
        console.error('Analytics Tracking Error:', error);
        // We don't throw here to avoid blocking the main flow if analytics fails
    }
};
