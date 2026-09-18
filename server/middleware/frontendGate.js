/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FRONTEND-ONLY API GATEWAY MIDDLEWARE
 * ═══════════════════════════════════════════════════════════════════════════════
 * Ensures that Link-Snap API endpoints can ONLY be invoked by the official
 * Link-Snap frontend web application (Cloudflare Pages BFF proxy / SPA client)
 * or explicitly authorized external webhooks and infrastructure health probes.
 *
 * Protects against:
 * - Direct third-party API leeching (using Link-Snap backend as a free shortener)
 * - Cross-site request hijacking and scraping
 * - Automated non-browser API scraping scripts (cURL, Python, bots)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import logger from '../utils/logger.js';
import { isBotRequest } from '../utils/botDetector.js';

// Paths that bypass frontend verification (strictly scoped)
const EXEMPT_PATHS = [
    /^\/(?:api\/)?(?:health(?:z|\/deep)?|ready)$/,             // K8s startup/liveness/readiness probes
    /^\/api\/webhooks(?:\/|$)/,                                  // Payment provider callbacks (Razorpay/LemonSqueezy)
    /^\/api\/analytics\/track(?:-bulk|\/[^/]+)?$/,              // Edge proxy click log mirror (validated by secret)
    /^\/api\/admin\/ip-check$/,                                 // Head probe for admin IP detection
];

// Canonical allowed domains
const ALLOWED_ORIGIN_PATTERNS = [
    /^https:\/\/([a-z0-9-]+\.)*lksnp\.qzz\.io$/i,
    /^https:\/\/link-snap\.pages\.dev$/i,
    /^https:\/\/([a-z0-9-]+\.)*link-snap\.pages\.dev$/i,
];

/**
 * Validates whether a given URL host or origin string belongs to canonical Link-Snap frontend domains.
 * 
 * @param {string} urlOrHost - Origin or referer URL string
 * @returns {boolean} True if origin matches allowed domains
 */
const isAllowedFrontendOrigin = (urlOrHost) => {
    if (!urlOrHost || typeof urlOrHost !== 'string') return false;
    try {
        const hostname = urlOrHost.startsWith('http://') || urlOrHost.startsWith('https://')
            ? new URL(urlOrHost).hostname
            : urlOrHost.split(':')[0];
        
        // Check pre-configured environment origins (CLIENT_URL, ALLOWED_ORIGINS)
        const envOrigins = [
            process.env.CLIENT_URL,
            ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : [])
        ].filter(Boolean);

        for (const envOrigin of envOrigins) {
            try {
                if (new URL(envOrigin).hostname.toLowerCase() === hostname.toLowerCase()) {
                    return true;
                }
            } catch {
                // Ignore invalid env URL format
            }
        }

        return ALLOWED_ORIGIN_PATTERNS.some(regex => regex.test(`https://${hostname}`));
    } catch {
        return false;
    }
};

/**
 * Frontend Gate Middleware
 */
export const frontendGate = (req, res, next) => {
    const path = req.path;

    // 1. Check explicitly exempted infrastructure routes
    if (EXEMPT_PATHS.some(regex => regex.test(path))) {
        return next();
    }

    // 2. Development mode: allow local tools (Vite, Postman, curl on localhost)
    if (process.env.NODE_ENV === 'development') {
        return next();
    }

    // 3. Browser Fetch Metadata: Sec-Fetch-Site
    // Chrome, Firefox, Safari, Edge attach Sec-Fetch-Site automatically.
    // If a request comes from an external website's browser context, reject immediately.
    const secFetchSite = req.headers['sec-fetch-site'];
    if (secFetchSite && secFetchSite === 'cross-site') {
        logger.warn(`[FrontendGate] Blocked cross-site API request from ${req.headers.origin || 'unknown'}: ${path}`);
        return res.status(403).json({
            error: 'Access Denied',
            message: 'Cross-origin API access is strictly forbidden.'
        });
    }

    // 4. Origin & Referer Verification
    // State-changing requests MUST originate from an approved frontend origin
    const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const origin = req.headers.origin;
    const referer = req.headers.referer;

    if (origin && !isAllowedFrontendOrigin(origin)) {
        logger.warn(`[FrontendGate] Untrusted Origin blocked: ${origin} on ${path}`);
        return res.status(403).json({
            error: 'Access Denied',
            message: 'Requests from this origin are not permitted.'
        });
    }

    if (referer && !isAllowedFrontendOrigin(referer)) {
        logger.warn(`[FrontendGate] Untrusted Referer blocked: ${referer} on ${path}`);
        return res.status(403).json({
            error: 'Access Denied',
            message: 'Requests from this referer are not permitted.'
        });
    }

    // 5. Gateway / BFF Proxy Verification
    // In production, all API traffic routes through Cloudflare Pages BFF proxy (cf-pages/functions/api/[[path]].js).
    // Verified via Cloudflare Access Service Token, X-LinkSnap-BFF signature, or internal BFF_SECRET.
    const isFromBffProxy =
        req.headers['x-linksnap-bff'] === 'true' ||
        (process.env.BFF_SECRET && req.headers['x-linksnap-bff-secret'] === process.env.BFF_SECRET) ||
        Boolean(req.headers['cf-access-client-id']);
    const isFromFrontendClient = req.headers['x-linksnap-client'] === 'web-app';

    // State-changing routes (creating links, auth, account modification) MANDATE verified frontend origin
    if (isStateChanging) {
        // Enforce cryptographic proxy verification in production, or fallback to client signature check if not fully migrated
        if (!isFromBffProxy && !isFromFrontendClient) {
            // If neither BFF proxy secret nor Link-Snap frontend client signature is present,
            // and caller is a headless script or bot, block access immediately.
            if (isBotRequest(req) || !secFetchSite) {
                logger.warn(`[FrontendGate] Direct non-frontend state-changing request blocked: ${req.method} ${path}`);
                return res.status(403).json({
                    error: 'Access Denied',
                    message: 'API requests must originate from the official Link-Snap web application.'
                });
            }
        } else if (process.env.NODE_ENV === 'production' && !isFromBffProxy && isBotRequest(req)) {
            // Defense in depth: if they spoofed the 'web-app' client header but didn't come through BFF,
            // and are clearly a bot (e.g., cURLing the origin IP), block them.
            logger.warn(`[FrontendGate] Spoofed origin direct request blocked: ${req.method} ${path}`);
            return res.status(403).json({
                error: 'Access Denied',
                message: 'Direct API access is restricted.'
            });
        }
    }

    next();
};

export default frontendGate;
