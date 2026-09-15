import { getUserIP } from './strictProxyGate.js';
import { checkJailStatus, checkRestrictedRate, isWhitelisted } from '../services/restrictedZoneService.js';
import logger from '../utils/logger.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RESTRICTED ZONE GATE MIDDLEWARE
 * ═══════════════════════════════════════════════════════════════════════════════
 * First-line defense gate intercepting requests directly behind strictProxyGate.
 * Blocks or throttles IPs in the Restricted Zone / IP Jail before database queries,
 * session lookups, or heavy controller logic are executed.
 * 
 * Enforces:
 * - Tier 3 (Blocked): Immediate HTTP 403 (JSON for API, branded page for redirects)
 * - Tier 2 (Quarantine): Blocks state-changing mutations (POST/PUT/DELETE) + 1 req/30s
 * - Tier 1 (Restricted): 3 req/10s throttling
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Paths completely exempted from jail checks (health checks & static assets)
const EXEMPT_PATHS = new Set([
    '/health',
    '/ready',
    '/live',
    '/api/health',
    '/robots.txt',
    '/sitemap.xml',
    '/manifest.json',
    '/manifest.webmanifest',
    '/sw.js',
    '/favicon.ico',
    '/favicon.svg',
    '/favicon-16x16.png',
    '/favicon-32x32.png',
    '/apple-touch-icon.png',
]);

// Helper to escape HTML characters and prevent XSS / HTML injection
const escapeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

/**
 * Generates lightweight, zero-overhead HTML security page for blocked browser visitors.
 */
const getBlockedHtmlPage = (ip, retryAfterSeconds, reason) => {
    const minutes = Math.ceil(retryAfterSeconds / 60);
    const durationLabel = minutes > 60 ? `${Math.ceil(minutes / 60)} hours` : `${minutes} minutes`;
    const safeIp = escapeHtml(String(ip || ''));
    const safeReason = escapeHtml(String(reason || 'Security Policy').replace(/_/g, ' '));

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Access Restricted | LinkSnap Security</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #090d16;
            color: #f1f5f9;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
        }
        .card {
            background: #0f172a;
            border: 1px solid #1e293b;
            border-radius: 16px;
            max-width: 480px;
            width: 100%;
            padding: 2.5rem;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(239, 68, 68, 0.1);
        }
        .icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 1.5rem;
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ef4444;
        }
        .icon svg { width: 32px; height: 32px; fill: none; stroke: currentColor; stroke-width: 2; }
        h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.75rem; color: #f8fafc; }
        p { font-size: 0.95rem; color: #94a3b8; line-height: 1.6; margin-bottom: 1.5rem; }
        .details {
            background: #0b1120;
            border: 1px solid #1e293b;
            border-radius: 8px;
            padding: 1rem;
            font-size: 0.85rem;
            text-align: left;
            margin-bottom: 1.5rem;
        }
        .details div { display: flex; justify-content: space-between; padding: 0.25rem 0; }
        .label { color: #64748b; }
        .val { color: #cbd5e1; font-family: monospace; }
        .footer { font-size: 0.8rem; color: #475569; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">
            <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z"/></svg>
        </div>
        <h1>Security Check Triggered</h1>
        <p>Access from this connection is temporarily restricted due to excessive rapid requests or automated bot behavior.</p>
        <div class="details">
            <div><span class="label">IP Address:</span><span class="val">${safeIp}</span></div>
            <div><span class="label">Restriction:</span><span class="val">Restricted Zone (Active)</span></div>
            <div><span class="label">Reason:</span><span class="val">${safeReason}</span></div>
            <div><span class="label">Estimated Cooldown:</span><span class="val">~${durationLabel}</span></div>
        </div>
        <div class="footer">
            Protected by LinkSnap Automated Edge Shield
        </div>
    </div>
</body>
</html>`;
};

export const restrictedZoneGate = async (req, res, next) => {
    const path = req.path || '';

    // Fast bypass for static files & health probes
    if (EXEMPT_PATHS.has(path) || path.startsWith('/assets/')) {
        return next();
    }

    const clientIP = getUserIP(req);

    // Whitelisted IPs never get evaluated or blocked
    if (isWhitelisted(clientIP)) {
        return next();
    }

    try {
        const jail = await checkJailStatus(clientIP);

        if (!jail.isJailed) {
            return next();
        }

        const isApiRequest = path.startsWith('/api/');
        req.jailStatus = jail;

        // 1. TIER 3: HARD BLOCK (Immediate 403)
        if (jail.status === 'blocked') {
            res.setHeader('Retry-After', jail.retryAfterSeconds);
            res.setHeader('X-Restricted-Zone', 'blocked');

            if (isApiRequest) {
                return res.status(403).json({
                    error: 'Access Denied',
                    code: 'IP_BLOCKED',
                    message: 'Access from your IP is temporarily blocked due to automated bot or scraper behavior.',
                    retryAfter: jail.retryAfterSeconds,
                });
            }

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            return res.status(403).send(getBlockedHtmlPage(clientIP, jail.retryAfterSeconds, jail.reason));
        }

        // 2. TIER 2: QUARANTINE (Block all mutations + heavily throttle reads)
        if (jail.status === 'quarantine') {
            res.setHeader('X-Restricted-Zone', 'quarantine');

            // Disallow all state-altering requests (POST, PUT, DELETE, PATCH)
            const method = req.method.toUpperCase();
            if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
                return res.status(403).json({
                    error: 'Action Restricted',
                    code: 'QUARANTINE_MUTATION_BLOCKED',
                    message: 'Form submissions and state mutations are temporarily prohibited from this connection.',
                    retryAfter: jail.retryAfterSeconds,
                });
            }

            // Throttle GET/read requests
            const throttle = await checkRestrictedRate(clientIP, 'quarantine');
            if (!throttle.allowed) {
                res.setHeader('Retry-After', throttle.retryAfterSeconds);
                return res.status(429).json({
                    error: 'Too Many Requests',
                    code: 'RESTRICTED_THROTTLED',
                    message: 'Your connection is quarantined. Please slow down.',
                    retryAfter: throttle.retryAfterSeconds,
                });
            }

            return next();
        }

        // 3. TIER 1: RESTRICTED ZONE (Throttle to 3 req / 10s)
        if (jail.status === 'restricted') {
            res.setHeader('X-Restricted-Zone', 'restricted');
            const throttle = await checkRestrictedRate(clientIP, 'restricted');
            if (!throttle.allowed) {
                res.setHeader('Retry-After', throttle.retryAfterSeconds);
                return res.status(429).json({
                    error: 'Too Many Requests',
                    code: 'RESTRICTED_THROTTLED',
                    message: 'Excessive requests detected. Please slow down.',
                    retryAfter: throttle.retryAfterSeconds,
                });
            }

            return next();
        }

        next();
    } catch (err) {
        logger.error(`[RestrictedZoneGate] Error checking status for ${clientIP}: ${err.message}`);
        // Resilient fail-open on internal gate error to avoid locking out genuine users unexpectedly
        next();
    }
};

export default restrictedZoneGate;
