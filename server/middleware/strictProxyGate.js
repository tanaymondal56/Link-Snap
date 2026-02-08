/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * STRICT PROXY GATE MIDDLEWARE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Security middleware that ensures ALL requests come through authorized proxies.
 * This is part of the Azure → AWS migration architecture where:
 * 
 *   Users → Azure (Nginx) → Tailscale VPN → AWS (This Server)
 * 
 * SECURITY LAYERS:
 * ─────────────────
 * 1. Secret Token Validation - X-LinkSnap-Proxy-Secret header
 * 2. IP Whitelist - Only trusted Tailscale IPs (TRUSTED_PROXY_IPS)
 * 3. Tailscale Subnet - Validates 100.64.0.0/10 subnet
 * 4. Real User IP Extraction - For rate limiting & banning
 * 
 * FEATURES:
 * ─────────
 * ✓ Toggle on/off via PROXY_GATE_ENABLED env var
 * ✓ Multiple proxy IPs (comma-separated)
 * ✓ Health check endpoint bypass (/health)
 * ✓ Real user IP passthrough for rate limiting
 * ✓ Startup config validation
 * 
 * ENVIRONMENT VARIABLES:
 * ──────────────────────
 * PROXY_GATE_ENABLED  - 'true' to enable, 'false' for local dev (default: false)
 * PROXY_SECRET        - 64-char hex secret (must match Nginx config)
 * TRUSTED_PROXY_IPS   - Comma-separated Tailscale IPs (e.g., "100.90.234.100,100.90.234.101")
 * REAL_IP_HEADER      - Header name for real user IP (default: 'x-real-ip')
 * 
 * USAGE:
 * ──────
 * In server/index.js:
 *   import { strictProxyGate, validateProxyGateConfig } from './middleware/strictProxyGate.js';
 *   app.use(strictProxyGate);  // Before routes
 *   validateProxyGateConfig(); // After middleware setup
 * 
 * @module middleware/strictProxyGate
 * @author LinkSnap Team
 * @version 2.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse comma-separated IPs from environment variable
 * @param {string} envValue - Comma-separated IP string
 * @returns {string[]} Array of trimmed IP addresses
 */
const parseTrustedIPs = (envValue) => {
    if (!envValue) return [];
    return envValue
        .split(',')
        .map(ip => ip.trim())
        .filter(ip => ip.length > 0);
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION (Loaded from .env only - NO hardcoded values!)
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
    // Master toggle - set to 'false' for local development
    enabled: process.env.PROXY_GATE_ENABLED === 'true',

    // Secret token (must match Azure Nginx config exactly)
    secret: process.env.PROXY_SECRET,

    // Trusted proxy IPs (supports legacy singular and new plural naming)
    // Example: "100.90.234.100" or "100.90.234.100,100.90.234.101"
    trustedProxyIPs: parseTrustedIPs(
        process.env.TRUSTED_PROXY_IPS || process.env.TRUSTED_PROXY_IP
    ),

    // Header name for real user IP (set by Azure Nginx: proxy_set_header X-Real-IP $remote_addr)
    realIpHeader: (process.env.REAL_IP_HEADER || 'x-real-ip').toLowerCase(),

    // Header name for secret token (set by Azure Nginx)
    secretHeader: 'x-linksnap-proxy-secret',

    // Health check path that bypasses all authentication
    // Used by load balancers, monitoring services, and Nginx health checks
    healthCheckPath: '/health',
};

// ═══════════════════════════════════════════════════════════════════════════════
// IP EXTRACTION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract the connecting IP address (could be Tailscale IP or direct connection)
 * Handles IPv6-mapped IPv4 addresses (::ffff:192.168.1.1 → 192.168.1.1)
 * 
 * IMPORTANT: Always uses socket.remoteAddress to get the DIRECT connection,
 * not req.ip which can be influenced by X-Forwarded-For headers.
 * 
 * @param {import('express').Request} req - Express request object
 * @returns {string} The connecting IP address
 */
const getConnectingIP = (req) => {
    // Use socket.remoteAddress directly (bypasses Express trust proxy logic)
    // This gives us the ACTUAL connecting IP (should be Azure Tailscale IP)
    let ip = req.socket?.remoteAddress ||
        req.connection?.remoteAddress ||
        'unknown';

    // Normalize IPv6-mapped IPv4 addresses
    // Example: ::ffff:192.168.1.1 → 192.168.1.1
    if (typeof ip === 'string' && ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
    }

    return ip;
};

/**
 * Extract the REAL user's IP (passed by Azure Nginx in X-Real-IP header)
 * Falls back to X-Forwarded-For, then to connecting IP
 * 
 * Priority:
 * 1. X-Real-IP header (set explicitly by Nginx)
 * 2. First IP in X-Forwarded-For chain
 * 3. Direct connecting IP (fallback)
 * 
 * @param {import('express').Request} req - Express request object
 * @returns {string} The real user's IP address
 */
const getRealUserIP = (req) => {
    // Check explicit real-ip header first (most reliable)
    const realIp = req.headers[CONFIG.realIpHeader];
    if (realIp && typeof realIp === 'string') {
        return realIp.trim();
    }

    // Fall back to X-Forwarded-For (first IP in chain is original client)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor && typeof forwardedFor === 'string') {
        return forwardedFor.split(',')[0].trim();
    }

    // Final fallback to direct connection IP
    return getConnectingIP(req);
};

// ═══════════════════════════════════════════════════════════════════════════════
// IP VALIDATION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if IP is in Tailscale's CGNAT subnet (100.64.0.0/10)
 * Tailscale uses this range for all devices on the tailnet
 * 
 * Range: 100.64.0.0 - 100.127.255.255
 * 
 * @param {string} ip - IP address to check
 * @returns {boolean} True if IP is in Tailscale subnet
 */
const isTailscaleSubnet = (ip) => {
    if (!ip || typeof ip !== 'string') return false;

    const parts = ip.split('.');
    if (parts.length !== 4) return false;

    const firstOctet = parseInt(parts[0], 10);
    const secondOctet = parseInt(parts[1], 10);

    // Tailscale uses CGNAT range: 100.64.0.0/10
    // First octet must be 100
    // Second octet must be 64-127 (binary: 01xxxxxx)
    return firstOctet === 100 && secondOctet >= 64 && secondOctet <= 127;
};

/**
 * Check if IP is in the explicitly trusted list
 * 
 * @param {string} ip - IP address to check
 * @returns {boolean} True if IP is explicitly trusted
 */
const isTrustedIP = (ip) => {
    return CONFIG.trustedProxyIPs.includes(ip);
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Strict Proxy Gate Middleware
 * 
 * Validates all incoming requests and ensures they come through authorized proxies.
 * Attaches the real user IP to req.realUserIP for downstream use.
 * 
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export const strictProxyGate = (req, res, next) => {
    // ═══════════════════════════════════════════════════════════════════════════
    // 0. STATIC ASSETS BYPASS
    // ═══════════════════════════════════════════════════════════════════════════
    // Allow static assets to be served without proxy authentication
    // These are public files that should be accessible directly
    if (
        req.path.startsWith('/assets/') ||
        req.path === '/manifest.json' ||
        req.path === '/robots.txt' ||
        req.path === '/sitemap.xml' ||
        req.path === '/sw.js' ||
        req.path === '/favicon.ico'
    ) {
        // Set real user IP for logging (use connecting IP for static assets)
        req.realUserIP = getConnectingIP(req);
        return next();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 0.5. PUBLIC API ENDPOINTS BYPASS
    // ═══════════════════════════════════════════════════════════════════════════
    // These API routes are public and should be accessible without proxy auth headers
    // They are still accessible through the proxy, just don't require the secret header
    const publicApiPaths = [
        '/api/changelog',        // Public changelog page
        '/api/roadmap',          // Public roadmap page
        '/api/feedback',         // Public feedback submission (POST)
        '/api/url/',             // URL redirect (GET /:shortId)
        '/api/auth/',            // Auth routes (login, register, etc.)
        '/api/users/public',     // Public profile data
    ];
    
    const isPublicApi = publicApiPaths.some(path => req.path.startsWith(path));
    
    if (isPublicApi) {
        // Still extract real user IP for rate limiting and logging
        req.realUserIP = getRealUserIP(req) || getConnectingIP(req);
        return next();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. HEALTH CHECK BYPASS
    // ═══════════════════════════════════════════════════════════════════════════
    // Allow health checks without authentication for:
    // - Load balancer health probes
    // - External monitoring services (UptimeRobot, etc.)
    // - Nginx upstream health checks
    if (req.path === CONFIG.healthCheckPath && req.method === 'GET') {
        return res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            // Don't expose internal details in health check
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. BYPASS CHECK - For Local Development
    // ═══════════════════════════════════════════════════════════════════════════
    // When PROXY_GATE_ENABLED=false, skip all security checks
    // Use this for local development where you're not behind a proxy
    if (!CONFIG.enabled) {
        // In dev mode, use direct connection IP as "real" IP
        req.realUserIP = getConnectingIP(req);
        return next();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. SECRET TOKEN VALIDATION
    // ═══════════════════════════════════════════════════════════════════════════
    // Check for the secret token header set by Azure Nginx
    // This is the first line of defense at the application level
    const clientSecret = req.headers[CONFIG.secretHeader];

    if (!clientSecret || clientSecret !== CONFIG.secret) {
        // Log for security monitoring (avoid logging the secret itself!)
        console.warn(`[ProxyGate] ❌ BLOCKED - Invalid/missing secret token`);
        console.warn(`[ProxyGate]    Connecting IP: ${getConnectingIP(req)}`);
        console.warn(`[ProxyGate]    Path: ${req.method} ${req.path}`);
        console.warn(`[ProxyGate]    Has Secret: ${!!clientSecret}`);

        // Return vague error - don't reveal security details to attackers
        return res.status(403).json({
            error: 'Access Denied',
            message: 'This endpoint is not publicly accessible.',
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. IP WHITELIST VALIDATION (Defense in Depth)
    // ═══════════════════════════════════════════════════════════════════════════
    // Even with valid secret, verify the request comes from trusted network
    // This prevents secret token leakage from granting access
    const connectingIP = getConnectingIP(req);

    // Allow if EITHER:
    // - IP is in Tailscale subnet (100.64.0.0/10)
    // - IP is in explicit trusted list
    const isInTailscaleSubnet = isTailscaleSubnet(connectingIP);
    const isExplicitlyTrusted = isTrustedIP(connectingIP);

    if (!isInTailscaleSubnet && !isExplicitlyTrusted) {
        console.warn(`[ProxyGate] ❌ BLOCKED - Untrusted IP with valid secret`);
        console.warn(`[ProxyGate]    Connecting IP: ${connectingIP}`);
        console.warn(`[ProxyGate]    Trusted IPs: ${CONFIG.trustedProxyIPs.join(', ') || '(none configured)'}`);
        console.warn(`[ProxyGate]    In Tailscale Subnet: ${isInTailscaleSubnet}`);

        return res.status(403).json({
            error: 'Access Denied',
            message: 'This endpoint is not publicly accessible.',
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. EXTRACT REAL USER IP
    // ═══════════════════════════════════════════════════════════════════════════
    // Extract the actual user's IP from headers for:
    // - Rate limiting (so we limit real users, not the proxy)
    // - Ban system (so we ban real users, not the proxy)
    // - Analytics and logging
    req.realUserIP = getRealUserIP(req);

    // Debug log in non-production (remove or adjust for production)
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[ProxyGate] ✓ Request via ${connectingIP} → Real User: ${req.realUserIP}`);
    }

    next();
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the real user IP from request
 * 
 * Use this in rate limiters and ban systems instead of req.ip
 * This ensures you're limiting/banning the actual user, not the Azure proxy
 * 
 * @example
 * import { getUserIP } from './middleware/strictProxyGate.js';
 * 
 * // In rate limiter:
 * skip: (req) => isWhitelisted(getUserIP(req))
 * 
 * // In ban check:
 * const userIP = getUserIP(req);
 * const isBanned = await checkBan(userIP);
 * 
 * @param {import('express').Request} req - Express request object
 * @returns {string} The real user's IP address
 */
export const getUserIP = (req) => {
    // If proxy gate has processed the request, use the extracted real IP
    // Otherwise fall back to Express's IP detection
    return req.realUserIP || req.ip || 'unknown';
};

// ═══════════════════════════════════════════════════════════════════════════════
// STARTUP VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate proxy gate configuration on server startup
 * 
 * Call this after setting up middleware to ensure all required
 * environment variables are properly configured.
 * 
 * Will exit the process with error if misconfigured in production.
 * 
 * @example
 * // In server/index.js, after middleware setup:
 * validateProxyGateConfig();
 */
export const validateProxyGateConfig = () => {
    console.log('\n[ProxyGate] ═══════════════════════════════════════════════════════');

    if (CONFIG.enabled) {
        const errors = [];
        const warnings = [];

        // Check required configuration
        if (!CONFIG.secret) {
            errors.push('PROXY_SECRET is required when PROXY_GATE_ENABLED=true');
        }

        if (CONFIG.trustedProxyIPs.length === 0) {
            errors.push('TRUSTED_PROXY_IPS (or TRUSTED_PROXY_IP) is required when PROXY_GATE_ENABLED=true');
        }

        // Validate secret strength
        if (CONFIG.secret && CONFIG.secret.length < 32) {
            errors.push('PROXY_SECRET must be at least 32 characters (recommend 64-char hex from: openssl rand -hex 32)');
        }

        // Check for common mistakes
        if (CONFIG.secret && CONFIG.secret.includes(' ')) {
            warnings.push('PROXY_SECRET contains spaces - this may cause header matching issues');
        }

        // Validate IP format (basic check)
        CONFIG.trustedProxyIPs.forEach(ip => {
            if (!ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
                warnings.push(`Trusted IP "${ip}" doesn't look like a valid IPv4 address`);
            }
        });

        // Exit on errors
        if (errors.length > 0) {
            console.error('[ProxyGate] ❌ CONFIGURATION ERRORS:');
            errors.forEach(e => console.error(`[ProxyGate]    • ${e}`));
            console.error('[ProxyGate] ═══════════════════════════════════════════════════════\n');
            process.exit(1);
        }

        // Show warnings
        if (warnings.length > 0) {
            console.warn('[ProxyGate] ⚠️  WARNINGS:');
            warnings.forEach(w => console.warn(`[ProxyGate]    • ${w}`));
        }

        // Success message
        console.log('[ProxyGate] ✓ Security middleware ENABLED');
        console.log(`[ProxyGate]   • Trusted Proxies: ${CONFIG.trustedProxyIPs.join(', ')}`);
        console.log(`[ProxyGate]   • Real IP Header: ${CONFIG.realIpHeader}`);
        console.log(`[ProxyGate]   • Health Check: GET ${CONFIG.healthCheckPath} (bypasses auth)`);
        console.log(`[ProxyGate]   • Secret Token: ${CONFIG.secret.substring(0, 8)}...${CONFIG.secret.substring(CONFIG.secret.length - 4)}`);

    } else {
        // Disabled mode
        console.warn('[ProxyGate] ⚠️  Security middleware DISABLED');
        console.warn('[ProxyGate]    Set PROXY_GATE_ENABLED=true for production');
        console.warn('[ProxyGate]    Current mode: Direct access allowed (development)');
    }

    console.log('[ProxyGate] ═══════════════════════════════════════════════════════\n');
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT (for flexibility)
// ═══════════════════════════════════════════════════════════════════════════════

export default strictProxyGate;
