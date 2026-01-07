import crypto from 'crypto';

// CSRF Token Configuration
const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'x-xsrf-token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure CSRF token
 */
export const generateCsrfToken = () => {
    return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
};

/**
 * Middleware to set CSRF token cookie
 * This should be called on initial page load or login
 */
export const setCsrfToken = (req, res, next) => {
    // Only set if not already present or expired
    if (!req.cookies[CSRF_COOKIE_NAME]) {
        const token = generateCsrfToken();
        res.cookie(CSRF_COOKIE_NAME, token, {
            httpOnly: false, // Must be false so JS can read it
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            path: '/'
        });
    }
    next();
};

/**
 * Middleware to validate CSRF token
 * Validates that the token in the header matches the cookie
 * This implements the "double-submit cookie" pattern
 * 
 * Skip validation for:
 * - GET, HEAD, OPTIONS requests (safe methods)
 * - Webhook endpoints (use their own signature verification)
 * - Public API endpoints that don't use cookies
 */
export const validateCsrfToken = (req, res, next) => {
    // Skip safe HTTP methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
        return next();
    }

    // Skip webhook endpoints (they use signature verification)
    if (req.path.startsWith('/api/webhooks')) {
        return next();
    }

    // Skip if no cookies are present (API-only requests with Bearer tokens)
    // This allows stateless JWT authentication to work without CSRF
    if (!req.cookies || Object.keys(req.cookies).length === 0) {
        return next();
    }
    
    // Skip if JWT cookie is not present (not a session-based request)
    if (!req.cookies.jwt && !req.cookies[CSRF_COOKIE_NAME]) {
        return next();
    }

    // Get token from cookie and header
    const cookieToken = req.cookies[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME];

    // If using cookies for auth, require CSRF validation
    if (req.cookies.jwt) {
        if (!cookieToken) {
            return res.status(403).json({
                message: 'CSRF token missing. Please refresh the page.'
            });
        }

        if (!headerToken) {
            return res.status(403).json({
                message: 'CSRF token header missing. Please include X-XSRF-TOKEN header.'
            });
        }

        // Timing-safe comparison
        try {
            const cookieBuffer = Buffer.from(cookieToken);
            const headerBuffer = Buffer.from(headerToken);

            if (cookieBuffer.length !== headerBuffer.length ||
                !crypto.timingSafeEqual(cookieBuffer, headerBuffer)) {
                return res.status(403).json({
                    message: 'Invalid CSRF token. Please refresh the page and try again.'
                });
            }
        } catch {
            return res.status(403).json({
                message: 'CSRF validation failed.'
            });
        }
    }

    next();
};

export default {
    setCsrfToken,
    validateCsrfToken,
    generateCsrfToken
};
