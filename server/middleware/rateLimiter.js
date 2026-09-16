import baseRateLimit from 'express-rate-limit';
import { getEffectiveTier } from '../services/subscriptionService.js';
import { getUserIP } from './strictProxyGate.js';
import RedisStore from 'rate-limit-redis';
import { getRedisClient, getRedisDriver, isRedisConfigured, connectRedis } from '../config/redis.js';
import ipaddr from 'ipaddr.js';
import { LRUCache } from 'lru-cache';
import { recordViolation, isWhitelisted } from '../services/restrictedZoneService.js';

// Emergency in-memory fail-closed fallback store if Redis drops
const localMemoryLimitStore = new LRUCache({
    max: 50000,
    ttl: 60 * 60 * 1000, // 1 hour default
});

/**
 * Enhanced rate limiter wrapper that hooks repeated 429 threshold breaches
 * into the Restricted Zone / IP Jail service for automated strike escalation.
 * 
 * Flaw 1.1: Only limiters explicitly configured with `jailOnBreach: true` (e.g. security-critical
 * auth/brute-force endpoints) will trigger IP Jail violations. Standard product quota limiters
 * (link creation, username check, appeals) return 429 without jailing users.
 */
const rateLimit = (options = {}) => {
    const { jailOnBreach = false, ...rateLimitOptions } = options;
    const originalHandler = rateLimitOptions.handler;

    rateLimitOptions.handler = (req, res, next, opts) => {
        if (jailOnBreach) {
            const ip = getUserIP(req);
            const isGlobal = typeof rateLimitOptions.keyGenerator === 'function' && rateLimitOptions.keyGenerator(req) === 'global_register';

            if (ip && !isWhitelisted(ip) && !isGlobal) {
                recordViolation(ip, 'rate_limit_exceeded', {
                    path: req.originalUrl,
                    method: req.method,
                }).catch(() => {});
            }
        }

        if (originalHandler) {
            return originalHandler(req, res, next, opts);
        }
        return res.status(rateLimitOptions.statusCode || 429).send(rateLimitOptions.message || 'Too many requests');
    };

    return baseRateLimit(rateLimitOptions);
};

/**
 * Creates a RedisStore for express-rate-limit.
 * For ioredis (TCP): redis.call() is a native passthrough — no mapping needed.
 * For Upstash (HTTP REST): manually maps EVAL/EVALSHA/SCRIPT commands since the
 * Upstash SDK does not expose a generic .call() method.
 */
const createRedisStore = (prefix) => {
    if (!isRedisConfigured()) return undefined;

    return new RedisStore({
        sendCommand: async (...args) => {
            let redis = getRedisClient();
            if (!redis) {
                redis = await connectRedis();
            }

            // Resilient in-memory fail-closed fallback: when Redis is unavailable,
            // enforce rate limits locally in-process instead of allowing unbounded requests.
            if (!redis) {
                const cmd = args[0]?.toLowerCase();
                if (cmd === 'script') return 'local_mock_sha';
                if (cmd === 'evalsha' || cmd === 'eval') {
                    const numKeys = parseInt(args[2] || '1', 10);
                    const key = args[3] || 'default';
                    const windowMs = parseInt(args[3 + numKeys] || '60000', 10);
                    const current = (localMemoryLimitStore.get(key) || 0) + 1;
                    const remaining = localMemoryLimitStore.getRemainingTTL(key);
                    const effectiveTtl = (remaining && remaining > 0) ? remaining : (windowMs || 60000);
                    localMemoryLimitStore.set(key, current, { ttl: effectiveTtl });
                    return [current, effectiveTtl];
                }
                if (cmd === 'del') {
                    localMemoryLimitStore.delete(args[1]);
                    return 1;
                }
                return [1, 60000];
            }

            // ioredis TCP client: native .call() passthrough — most efficient path
            if (getRedisDriver() === 'tcp' && typeof redis.call === 'function') {
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
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
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
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    jailOnBreach: true,
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many login attempts from this IP, please try again after an hour' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

// Global Circuit Breaker for Registrations (Botnet Mitigation)
export const globalRegisterCircuitBreaker = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // max 100 signups per 5 mins globally
    store: createRedisStore('circuit:register'),
    keyGenerator: () => 'global_register', // All requests share this bucket
    handler: (req, res) => {
        res.status(429).json({ 
            message: 'Due to high traffic, new registrations are temporarily paused. Please try again in a few minutes.',
            circuitBreaker: true 
        });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const refreshLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 200,
    store: createRedisStore('refresh'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
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
    // Key strictly on client IP to close the User-Agent rotation bypass
    keyGenerator: (req) => `anon:ip:${getUserIP(req)}`,
    handler: (req, res) => res.status(429).json({
        type: 'rate_limit',
        message: 'Anonymous limit reached (5 links/hour). Sign up for more!',
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
    keyGenerator: (req) => `user:${req.user?._id || getUserIP(req)}`,
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
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res) => {
        res.status(429).send('Too many requests. Please slow down.');
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const appealLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    store: createRedisStore('appeal'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many appeal requests. Please wait before trying again.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const verifyOtpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    store: createRedisStore('otp'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    jailOnBreach: true,
    handler: (req, res) => {
        res.status(429).json({ message: 'Whoa there! Too many attempts. Please take a short break and try again in about 15 minutes. ☕' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3,
    store: createRedisStore('forgot'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    jailOnBreach: true,
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many password reset requests. Please try again in 15 minutes.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    store: createRedisStore('reset'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    jailOnBreach: true,
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many reset attempts. Please try again in 15 minutes.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const passwordVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    store: createRedisStore('pwd_verify'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    jailOnBreach: true,
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many password attempts. Please try again in 15 minutes.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const profileUpdateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    store: createRedisStore('profile'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many profile updates. Please try again later.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const usernameCheckLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    store: createRedisStore('usr_check'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many requests. Please slow down.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const adminNotificationLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    store: createRedisStore('notif_read'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many notification requests. Please try again later.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const adminNotificationWriteLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    store: createRedisStore('notif_write'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many notification updates. Please try again later.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const passwordChangeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    store: createRedisStore('pwd_change'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many password change attempts. Please try again in 15 minutes.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const logoutLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    store: createRedisStore('logout'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many logout requests. Please slow down.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const sessionManagementLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    store: createRedisStore('session_mgmt'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many session requests. Please slow down.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

export const devLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // higher limit for dev actions/testing
    store: createRedisStore('dev'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many developer actions from this IP, please try again after 15 minutes' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

// ─── Webhook Rate Limiting ───────────────────────────────────────────────────
// Payment providers (Razorpay, LemonSqueezy) are trusted and get unlimited throughput.
// All other sources are heavily restricted to prevent CPU-exhaustion DoS via
// expensive HMAC-SHA256 signature verification on garbage payloads.
//
// Configure trusted provider IPs in env:
//   WEBHOOK_TRUSTED_IPS=1.2.3.4,5.6.7.8,... (comma-separated)
//
const WEBHOOK_PROVIDER_IPS_RAW = process.env.WEBHOOK_TRUSTED_IPS
    ? process.env.WEBHOOK_TRUSTED_IPS.split(',').map(ip => ip.trim()).filter(Boolean)
    : [];

const parsedWebhookIPs = WEBHOOK_PROVIDER_IPS_RAW.map(ip => {
    try {
        if (ip.includes('/')) return { type: 'cidr', value: ipaddr.parseCIDR(ip) };
        return { type: 'ip', value: ipaddr.parse(ip) };
    } catch {
        return null;
    }
}).filter(Boolean);

const isWebhookProvider = (ipStr) => {
    if (!ipStr) return false;
    try {
        const incomingIp = ipaddr.parse(ipStr.replace(/^::ffff:/, ''));
        return parsedWebhookIPs.some(allowed => {
            if (allowed.type === 'cidr') {
                return incomingIp.kind() === allowed.value[0].kind() && incomingIp.match(allowed.value);
            }
            return incomingIp.toString() === allowed.value.toString();
        });
    } catch {
        return false;
    }
};

// Permissive limiter for known payment providers (anti-runaway DoS only)
const webhookProviderLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1000,
    store: createRedisStore('webhook_provider'),
    handler: (req, res) => {
        res.status(429).json({ message: 'Webhook rate limit exceeded.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

// Strict limiter for unknown/untrusted webhook sources (increased for LemonSqueezy dynamic IPs)
const webhookStrictLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // Increased to 100 to accommodate dynamic IPs from LemonSqueezy
    store: createRedisStore('webhook_strict'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res) => {
        // Return 403 not 429 to not reveal rate limiting details to probing attackers
        res.status(403).json({ message: 'Access denied.' });
    },
    skip: (req) => {
        const ip = getUserIP(req);
        return isWhitelisted(ip) || isWebhookProvider(ip);
    },
});

/**
 * Dynamic webhook rate limiter.
 * - Known payment provider IPs (WEBHOOK_TRUSTED_IPS): permissive (1000/min)
 * - All other sources: strict (5/min) — prevents CPU-exhaustion DoS
 */
export const webhookLimiter = (req, res, next) => {
    const ip = getUserIP(req);
    if (isWebhookProvider(ip)) {
        return webhookProviderLimiter(req, res, next);
    }
    return webhookStrictLimiter(req, res, next);
};

// ─── Public Bio Page Rate Limiting ──────────────────────────────────────────
// Prevents scraping of user bio pages / username enumeration
export const bioPublicLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60,
    store: createRedisStore('bio_public'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many requests. Please slow down.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

// ─── Biometric Auth Rate Limiting ────────────────────────────────────────────
// Applied to public challenge/verify endpoints for device (WebAuthn) auth
export const biometricAuthLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    store: createRedisStore('biometric'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    jailOnBreach: true,
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many authentication attempts. Please try again later.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

// ─── Passkey Health-Check Rate Limiting ─────────────────────────────────────
// Applied to authenticated passkey verification testing in admin console
export const passkeyHealthCheckLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 30, // 30 requests per 5 minutes
    store: createRedisStore('passkey-health'),
    keyGenerator: (req) => `${req.user?._id || getUserIP(req)}`,
    validate: { keyGeneratorIpFallback: false },
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many passkey verification attempts. Please wait a moment.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

// ─── Login Failed Threshold Rate Limiting ────────────────────────────────────
// Applied to failed credential attempts to trigger automated IP jail
export const loginFailedThresholdLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    store: createRedisStore('login_failed'),
    keyGenerator: (req) => getUserIP(req),
    validate: { keyGeneratorIpFallback: false },
    jailOnBreach: true,
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many failed login attempts from this IP. Please try again later.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});

// ─── Beta Tester Endpoint Rate Limiting ──────────────────────────────────────
// Prevents rapid exhaustion or brute-forcing of test codes and mock purchases
export const testerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    store: createRedisStore('tester'),
    keyGenerator: (req) => `${req.user?._id || getUserIP(req)}`,
    validate: { keyGeneratorIpFallback: false },
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many test requests. Please slow down.',
    handler: (req, res) => {
        res.status(429).json({ message: 'Too many test requests. Please slow down.' });
    },
    skip: (req) => isWhitelisted(getUserIP(req)),
});


