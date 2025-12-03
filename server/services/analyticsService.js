import Analytics from '../models/Analytics.js';
import useragent from 'useragent';
import geoip from 'geoip-lite';

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
        };

        await Analytics.create(analyticsData);
    } catch (error) {
        console.error('Analytics Tracking Error:', error);
        // We don't throw here to avoid blocking the main flow if analytics fails
    }
};
