import rateLimit from 'express-rate-limit';
import { getEffectiveTier } from '../services/subscriptionService.js';
import { getAnonFingerprint } from '../utils/fingerprint.js';
import { getUserIP } from './strictProxyGate.js';
import RedisStore from 'rate-limit-redis';
import { getRedisClient, isRedisConfigured } from '../config/redis.js';

// IPs that bypass rate limiting
const envAllowedIPs = process.env.RATE_LIMIT_WHITELIST_IPS ? process.env.RATE_LIMIT_WHITELIST_IPS.split(',').map(ip => ip.trim()) : [];

const whitelistedIPs = [
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    ...envAllowedIPs
];

const isWhitelisted = (ip) => {
    if (!ip) return false;
    const normalizedIP = ip.replace(/^::ffff:/, '');
    return whitelistedIPs.some(whitelistedIP =>
        ip === whitelistedIP ||
        normalizedIP === whitelistedIP ||
        ip.startsWith('::ffff:127.')
    );
};

/**
 * Creates a RedisStore for express-rate-limit.
 * For ioredis (TCP): redis.call() is a native passthrough — no mapping needed.
 * For Upstash (HTTP REST): manually maps EVAL/EVALSHA/SCRIPT commands since the
 * Upstash SDK does not expose a generic .call() method.
 * Falls back to MemoryStore (undefined) if Redis is not configured.
 */
const createRedisStore = (prefix) => {
    if (!isRedisConfigured()) return undefined;

    return new RedisStore({
        sendCommand: async (...args) => {
            const redis = getRedisClient();
            if (!redis) {
                throw new Error('Redis client is not available');
            }

            // ioredis TCP client: native .call() passthrough — most efficient path
            if (typeof redis.call === 'function') {
                return await redis.call(...args);
            }

            // Upstash HTTP client: map raw Redis protocol commands to SDK methods
            const command = args[0].toLowerCase();
            const cmdArgs = args.slice(1);

            if (command === 'script') {
                const subCommand = cmdArgs[0].toLowerCase();
                if (subCommand === 'load') {
                    return await redis.scriptLoad(cmdArgs[1]);
                }
                if (subCommand === 'exists') {
                    // Upstash scriptExists takes an array of SHAs
                    return await redis.scriptExists([cmdArgs[1]]);
                }
            }

            if (command === 'evalsha') {
                const sha = cmdArgs[0];
                const numKeys = parseInt(cmdArgs[1], 10);
                const keys = cmdArgs.slice(2, 2 + numKeys);
                const scriptArgs = cmdArgs.slice(2 + numKeys);
                // Upstash evalsha: (sha, keys[], args[])
                return await redis.evalsha(sha, keys, scriptArgs);
            }

            if (command === 'eval') {
                const script = cmdArgs[0];
                const numKeys = parseInt(cmdArgs[1], 10);
                const keys = cmdArgs.slice(2, 2 + numKeys);
                const scriptArgs = cmdArgs.slice(2 + numKeys);
                // Upstash eval: (script, keys[], args[])
                return await redis.eval(script, keys, scriptArgs);
            }

            // Generic command passthrough via Upstash method name mapping
            if (typeof redis[command] === 'function') {
                return await redis[command](...cmdArgs);
            }

            throw new Error(`Unsupported raw command in rate limiter store: ${command}`);
        },
        prefix: `ls:rl:${prefix}:`,
    });
};

export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    store: createRedisStore('api'),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many requests from this IP, please try again after 15 minutes' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    store: createRedisStore('auth'),
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many login attempts from this IP, please try again after an hour' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const refreshLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 200,
    store: createRedisStore('refresh'),
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many session refresh attempts. Please log in again.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

// Tiered Rate Limiters
const anonCreateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    store: createRedisStore('create:anon'),
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
    store: createRedisStore('create:free'),
    keyGenerator: (req) => `user:${req.user?._id || req.ip}`,
    handler: (req, res) => res.status(429).json({
        type: 'rate_limit',
        message: 'Free limit reached (10/hour). Upgrade for more!',
        retryAfter: 3600
    }),
    validate: { keyGeneratorIpFallback: false },
});

const proCreateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 50,
    store: createRedisStore('create:pro'),
    keyGenerator: (req) => `user:${req.user?._id}`,
    handler: (req, res) => res.status(429).json({
        type: 'rate_limit',
        message: 'Hourly creation limit reached (50/hour).',
        retryAfter: 3600
    }),
});

const businessCreateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5000,
    store: createRedisStore('create:biz'),
    keyGenerator: (req) => `user:${req.user?._id}`,
    handler: (req, res) => res.status(429).json({ message: 'Hourly API limit reached (5000/hour).' }),
});

export const createLinkLimiter = (req, res, next) => {
    if (!req.user) {
        return anonCreateLimiter(req, res, next);
    }
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

export const redirectLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100,
    store: createRedisStore('redirect'),
    handler: (req, res) => {
        res.status(429).send('Too many requests. Please slow down.');
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const appealLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    store: createRedisStore('appeal'),
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many appeal requests. Please wait before trying again.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const verifyOtpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    store: createRedisStore('otp'),
    handler: (req, res) => {
        res.status(429).json({ message: 'Whoa there! Too many attempts. Please take a short break and try again in about 15 minutes. ☕' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3,
    store: createRedisStore('forgot'),
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many password reset requests. Please try again in 15 minutes.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    store: createRedisStore('reset'),
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many reset attempts. Please try again in 15 minutes.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const passwordVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    store: createRedisStore('pwd_verify'),
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many password attempts. Please try again in 15 minutes.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const profileUpdateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    store: createRedisStore('profile'),
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many profile updates. Please try again later.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const usernameCheckLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    store: createRedisStore('usr_check'),
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many requests. Please slow down.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const adminNotificationLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    store: createRedisStore('notif_read'),
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many notification requests. Please try again later.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const adminNotificationWriteLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    store: createRedisStore('notif_write'),
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many notification updates. Please try again later.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const passwordChangeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    store: createRedisStore('pwd_change'),
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many password change attempts. Please try again in 15 minutes.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const logoutLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    store: createRedisStore('logout'),
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many logout requests. Please slow down.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const sessionManagementLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    store: createRedisStore('session_mgmt'),
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many session requests. Please slow down.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});
