import rateLimit from 'express-rate-limit';

// IPs that bypass rate limiting
// Add your trusted IPs here:
const whitelistedIPs = [
    // Localhost variations (always included)
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',

    // Add your trusted IPs below:
    // '203.0.113.50',    // Example: Your home public IP
    // '198.51.100.25',   // Example: Office IP
    // '10.0.0.50',       // Example: VPN IP
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
