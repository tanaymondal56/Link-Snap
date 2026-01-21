import rateLimit from 'express-rate-limit';
import { getEffectiveTier } from '../services/subscriptionService.js';
import { getAnonFingerprint } from '../utils/fingerprint.js';

// IPs that bypass rate limiting
// Add your trusted IPs to .env under RATE_LIMIT_WHITELIST_IPS
const envAllowedIPs = process.env.RATE_LIMIT_WHITELIST_IPS ? process.env.RATE_LIMIT_WHITELIST_IPS.split(',').map(ip => ip.trim()) : [];

const whitelistedIPs = [
    // Localhost variations (always included)
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',

    ...envAllowedIPs
];

const isWhitelisted = (ip) => {
    if (!ip) return false;

    // Normalize IPv6-mapped IPv4 addresses
    const normalizedIP = ip.replace(/^::ffff:/, '');

    return whitelistedIPs.some(whitelistedIP =>
        ip === whitelistedIP ||
        normalizedIP === whitelistedIP ||
        ip.startsWith('::ffff:127.')
    );
};

export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many requests from this IP, please try again after 15 minutes' });
    },
    skip: (req) => isWhitelisted(req.ip),
});

export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 login/register requests per hour
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many login attempts from this IP, please try again after an hour' });
    },
    skip: (req) => isWhitelisted(req.ip),
});

export const refreshLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 200, // Limit each IP to 200 refresh requests per hour (more generous)
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many session refresh attempts. Please log in again.' });
    },
    skip: (req) => isWhitelisted(req.ip),
});

// Tiered rate limiting uses getEffectiveTier and getAnonFingerprint (imported at top)

// Tiered Rate Limiters (Internal)
const anonCreateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    keyGenerator: (req) => `anon:${getAnonFingerprint(req)}`,
    handler: (req, res) => res.status(429).json({
        type: 'rate_limit',
        message: 'Anonymous limit reached. Sign up for more!',
        retryAfter: 3600
    }),
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
});

const freeCreateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => `user:${req.user?._id || req.ip}`,
    handler: (req, res) => res.status(429).json({
        type: 'rate_limit',
        message: 'Free limit reached (10/hour). Upgrade for more!',
        retryAfter: 3600
    }),
    validate: { keyGeneratorIpFallback: false }, // Suppress IPv6 validation - we use userId when available, IP only as fallback
});

const proCreateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 50,
    keyGenerator: (req) => `user:${req.user?._id}`,
    handler: (req, res) => res.status(429).json({
        type: 'rate_limit',
        message: 'Hourly creation limit reached (50/hour).',
        retryAfter: 3600
    }),
});

const businessCreateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5000, // Increased to 5000/hour (approx 1.4/sec sustained) for bulk operations
    keyGenerator: (req) => `user:${req.user?._id}`,
    handler: (req, res) => res.status(429).json({ message: 'Hourly API limit reached (5000/hour).' }),
});

// Smart Limiter Wrapper
export const createLinkLimiter = (req, res, next) => {
    // If not logged in, use Anon limiter
    if (!req.user) {
        return anonCreateLimiter(req, res, next);
    }

    // Dispatch based on Tier
    const tier = getEffectiveTier(req.user);
    switch (tier) {
        case 'business':
            return businessCreateLimiter(req, res, next);
        case 'pro':
            return proCreateLimiter(req, res, next);
        default:
            return freeCreateLimiter(req, res, next);
    }
};

// Redirect rate limiter - generous but protects against abuse
export const redirectLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 redirects per minute per IP
    handler: (req, res) => {
        res.status(429).send('Too many requests. Please slow down.');
    },
    skip: (req) => isWhitelisted(req.ip),
});

export const appealLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 appeal-related requests per hour
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many appeal requests. Please wait before trying again.' });
    },
    skip: (req) => isWhitelisted(req.ip),
});

export const verifyOtpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Strict limit: 5 attempts per 15 minutes per IP
    handler: (req, res) => {
        res.status(429).json({ message: 'Whoa there! Too many attempts. Please take a short break and try again in about 15 minutes. ☕' });
    },
    skip: (req) => isWhitelisted(req.ip),
});

export const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // 3 requests per 15 minutes per IP
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many password reset requests. Please try again in 15 minutes.' });
    },
    skip: (req) => isWhitelisted(req.ip),
});

export const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes per IP
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many reset attempts. Please try again in 15 minutes.' });
    },
    skip: (req) => isWhitelisted(req.ip),
});

// Password verification limiter for protected links - strict to prevent brute force
export const passwordVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per 15 minutes per IP (allows for typos but prevents brute force)
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many password attempts. Please try again in 15 minutes.' });
    },
    skip: (req) => isWhitelisted(req.ip),
});

// Profile update limiter - prevent rapid username changes
export const profileUpdateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 profile updates per 15 minutes
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many profile updates. Please try again later.' });
    },
    skip: (req) => isWhitelisted(req.ip),
});

// Username availability check limiter - prevent enumeration attacks
export const usernameCheckLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 checks per minute (generous for real-time typing)
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many requests. Please slow down.' });
    },
    skip: (req) => isWhitelisted(req.ip),
});
