import rateLimit from 'express-rate-limit';

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

export const createLinkLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // Limit each IP to 50 link creations per hour
    handler: (req, res) => {
        res.status(429).json({ message: 'You have created too many links recently. Please try again later.' });
    },
    skip: (req) => isWhitelisted(req.ip),
});

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
