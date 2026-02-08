/**
 * Edge Analytics Controller
 * 
 * Handles analytics tracking from Nginx edge proxy mirror requests.
 * This allows caching redirects while still capturing 100% of clicks.
 * 
 * Flow:
 * 1. User clicks short URL (e.g., /abc123)
 * 2. Nginx serves cached redirect (fast!)
 * 3. Nginx mirrors request to /api/analytics/track/abc123 (async)
 * 4. This controller records the click (fire-and-forget)
 * 
 * Headers passed from Nginx:
 * - X-Real-IP: Original client IP
 * - User-Agent: Browser info
 * - Referer: Where they came from
 * - X-Short-Code: The short URL path
 */

import Url from '../models/Url.js';
import { trackVisit } from '../services/analyticsService.js';

/**
 * Track a click from edge proxy mirror
 * POST /api/analytics/track/:shortCode
 * 
 * This is called asynchronously by Nginx for every redirect request,
 * regardless of cache status. Responds immediately (204) to not block.
 */
export const trackEdgeClick = async (req, res) => {
    // Respond immediately - fire and forget pattern
    res.status(204).end();

    try {
        // Extract short code from path (remove leading slash if present)
        let shortCode = req.params.shortCode || req.headers['x-short-code'] || '';
        shortCode = shortCode.replace(/^\/+/, '');

        if (!shortCode || shortCode.length < 4 || shortCode.length > 12) {
            console.warn('[EdgeAnalytics] Invalid short code:', shortCode);
            return;
        }

        // Find the URL by shortId or customAlias
        const url = await Url.findOne({
            $or: [
                { shortId: shortCode },
                { customAlias: shortCode }
            ],
            isActive: { $ne: false }
        }).select('_id shortId').lean();

        if (!url) {
            // URL not found - might be deleted or invalid
            // Don't log error as this could be attack traffic
            return;
        }

        // Create a mock request object for trackVisit compatibility
        // Set realUserIP for proxy-aware extraction (matches strictProxyGate pattern)
        const realIP = req.headers['x-real-ip'] || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
        const mockReq = {
            headers: {
                'user-agent': req.headers['user-agent'] || 'Unknown',
                'referer': req.headers['referer'] || ''
            },
            realUserIP: realIP  // Used by getUserIP() for analytics
        };

        // Track the visit using existing analytics service
        // This uses the buffered insert for efficiency
        await trackVisit(url._id, mockReq, {
            deviceMatchType: 'edge_cached'  // Mark as edge-cached for analytics filtering
        });

        // console.log(`[EdgeAnalytics] Tracked click for ${shortCode}`);

    } catch (error) {
        // Silent fail - analytics shouldn't break anything
        console.error('[EdgeAnalytics] Error:', error.message);
    }
};

/**
 * Bulk track clicks (for log processing if needed)
 * POST /api/analytics/track-bulk
 * 
 * Body: { clicks: [{ shortCode, ip, userAgent, referer, timestamp }] }
 */
export const trackBulkClicks = async (req, res) => {
    // Respond immediately
    res.status(202).json({ message: 'Processing', count: req.body.clicks?.length || 0 });

    try {
        const { clicks } = req.body;
        if (!Array.isArray(clicks) || clicks.length === 0) return;

        // Limit to prevent abuse
        const limitedClicks = clicks.slice(0, 1000);

        for (const click of limitedClicks) {
            const { shortCode, ip, userAgent, referer } = click;

            if (!shortCode) continue;

            const url = await Url.findOne({
                $or: [
                    { shortId: shortCode },
                    { customAlias: shortCode }
                ]
            }).select('_id').lean();

            if (!url) continue;

            const mockReq = {
                headers: {
                    'user-agent': userAgent || 'Unknown',
                    'referer': referer || ''
                },
                realUserIP: ip || 'unknown'  // Used by getUserIP() for analytics
            };

            await trackVisit(url._id, mockReq, { deviceMatchType: 'bulk_import' });
        }

    } catch (error) {
        console.error('[EdgeAnalytics] Bulk Error:', error.message);
    }
};
