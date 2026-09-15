import { LRUCache } from 'lru-cache';
import logger from '../utils/logger.js';
import { redisGet, redisSet, redisDel, redisIncr, redisScan, getRedisClient } from '../config/redis.js';
import { isInternalClusterIP, formatPreferredIP } from '../utils/ipUtils.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RESTRICTED ZONE (IP JAIL) & BURST BOT DETECTION SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * High-performance, zero-client-overhead bot protection & IP quarantine engine.
 * 
 * Features:
 * - Sub-second sliding-window burst click detection (5 clicks in 2s threshold)
 * - Tiered strike escalation:
 *   • 1 Strike  -> Restricted Zone (15m): throttled to 3 req / 10s
 *   • 2 Strikes -> Quarantine (2h): throttled to 1 req / 30s, mutations blocked
 *   • 3 Strikes / Honeypot -> Hard Block (24h): HTTP 403 Forbidden across all endpoints
 * - Dual-driver Redis persistence with resilient in-memory LRU fallback
 * - Real user IP verification resisting proxy header forgery
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Configuration constants
export const JAIL_TIERS = {
    RESTRICTED: {
        status: 'restricted',
        durationSeconds: 15 * 60, // 15 minutes
        maxReqPerWindow: 3,
        windowSeconds: 10,
    },
    QUARANTINE: {
        status: 'quarantine',
        durationSeconds: 2 * 60 * 60, // 2 hours
        maxReqPerWindow: 1,
        windowSeconds: 30,
    },
    BLOCKED: {
        status: 'blocked',
        durationSeconds: 24 * 60 * 60, // 24 hours
        maxReqPerWindow: 0,
        windowSeconds: 86400,
    },
};

// Burst detection config
const BURST_CONFIG = {
    CLICK_THRESHOLD: 5,   // max 5 clicks
    CLICK_WINDOW_SEC: 2,  // within 2 seconds
};

// In-Memory Fallbacks (for single-pod dev mode or temporary Redis outages)
const localJailCache = new LRUCache({
    max: 20000,
    ttl: 24 * 60 * 60 * 1000, // 24 hours default
});

const localStrikeCache = new LRUCache({
    max: 20000,
    ttl: 24 * 60 * 60 * 1000, // 24 hours rolling strike decay
});

const localBurstCache = new LRUCache({
    max: 20000,
    ttl: 2000, // 2 seconds
});

const localThrottleCache = new LRUCache({
    max: 20000,
    ttl: 60 * 1000, // 1 minute
});

/**
 * Determine if an IP address is whitelisted from all restrictions.
 * Internal cluster IPs, localhost, RATE_LIMIT_WHITELIST_IPS, and ADMIN_WHITELIST_IPS are always exempt.
 * 
 * @param {string} ip - Normalized IP address
 * @returns {boolean}
 */
export const isWhitelisted = (ip) => {
    if (!ip || typeof ip !== 'string') return false;
    const clean = formatPreferredIP(ip);
    if (!clean) return false;

    // Loopback & private dev IPs
    if (clean === '127.0.0.1' || clean === '::1' || clean.startsWith('127.')) {
        return true;
    }

    // Internal cluster / pod networking
    if (isInternalClusterIP(clean)) {
        return true;
    }

    // Explicitly configured whitelist in RATE_LIMIT_WHITELIST_IPS or ADMIN_WHITELIST_IPS
    const checkList = (envVal) => {
        if (!envVal) return false;
        const allowedList = envVal.split(',').map(s => s.trim()).filter(Boolean);
        return allowedList.some(whitelisted => {
            const formatted = formatPreferredIP(whitelisted);
            return formatted === clean || whitelisted === clean;
        });
    };

    if (checkList(process.env.RATE_LIMIT_WHITELIST_IPS) || checkList(process.env.ADMIN_WHITELIST_IPS)) {
        return true;
    }

    return false;
};

/**
 * Check current jail / restricted status of an IP address.
 * 
 * @param {string} rawIp
 * @returns {Promise<{ isJailed: boolean, status: string|null, strikes: number, reason: string|null, meta: object|null, expiresAt: number|null, retryAfterSeconds: number }>}
 */
export const checkJailStatus = async (rawIp) => {
    const ip = formatPreferredIP(rawIp);
    if (!ip || isWhitelisted(ip)) {
        return { isJailed: false, status: null, strikes: 0, reason: null, meta: null, expiresAt: null, retryAfterSeconds: 0 };
    }

    const key = `ls:jail:status:${ip}`;
    let record = undefined;

    try {
        const redis = getRedisClient();
        if (redis) {
            record = await redisGet(key);
        }
    } catch (err) {
        logger.warn(`[RestrictedZone] Redis get status failed for ${ip}: ${err.message}`);
        record = undefined;
    }

    // Flaw 1.4: Differentiate between Redis missing key (record === null) and Redis offline/error (record === undefined)
    if (record === null) {
        // Key was explicitly deleted or naturally expired in Redis (e.g. admin unjailed IP or TTL expired)
        // Purge local pod cache to prevent multi-pod desync
        localJailCache.delete(ip);
        return { isJailed: false, status: null, strikes: 0, reason: null, meta: null, expiresAt: null, retryAfterSeconds: 0 };
    }

    if (record === undefined) {
        // Fall back to in-memory local cache only when Redis is unavailable
        record = localJailCache.get(ip);
    }

    if (!record || !record.expiresAt) {
        return { isJailed: false, status: null, strikes: 0, reason: null, meta: null, expiresAt: null, retryAfterSeconds: 0 };
    }

    const now = Date.now();
    if (now >= record.expiresAt) {
        // Expired
        localJailCache.delete(ip);
        return { isJailed: false, status: null, strikes: 0, reason: null, meta: null, expiresAt: null, retryAfterSeconds: 0 };
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((record.expiresAt - now) / 1000));

    return {
        isJailed: true,
        status: record.status,
        strikes: record.strikes || 1,
        reason: record.reason || 'security_policy_violation',
        meta: record.meta || {},
        expiresAt: record.expiresAt,
        retryAfterSeconds,
    };
};

/**
 * Record a security violation strike against an IP and escalate tier if necessary.
 * 
 * @param {string} rawIp - The client IP address
 * @param {string} reason - Cause of violation ('burst_clicks', 'honeypot_trap', 'quick_submit', 'rate_limit_exceeded', 'admin_action')
 * @param {object} meta - Optional contextual metadata
 * @param {boolean} directBlock - If true, immediately places into 24h hard block (Tier 3)
 * @returns {Promise<{ status: string, strikes: number, durationSeconds: number, expiresAt: number }>}
 */
export const recordViolation = async (rawIp, reason, meta = {}, directBlock = false) => {
    const ip = formatPreferredIP(rawIp);
    if (!ip || isWhitelisted(ip)) {
        return null;
    }

    const strikeKey = `ls:jail:strikes:${ip}`;
    const statusKey = `ls:jail:status:${ip}`;
    let strikes;

    // 1. Calculate strikes
    try {
        const redis = getRedisClient();
        let count = null;
        if (redis) {
            count = await redisIncr(strikeKey, 24 * 60 * 60); // 24h rolling decay
        }
        if (typeof count === 'number') {
            strikes = count;
        } else {
            const current = localStrikeCache.get(ip) || 0;
            const remainingTtl = localStrikeCache.getRemainingTTL(ip);
            const ttl = (remainingTtl && remainingTtl > 0) ? remainingTtl : (24 * 60 * 60 * 1000);
            strikes = current + 1;
            localStrikeCache.set(ip, strikes, { ttl });
        }
    } catch (err) {
        logger.warn(`[RestrictedZone] Strike increment failed for ${ip}: ${err.message}`);
        const current = localStrikeCache.get(ip) || 0;
        const remainingTtl = localStrikeCache.getRemainingTTL(ip);
        const ttl = (remainingTtl && remainingTtl > 0) ? remainingTtl : (24 * 60 * 60 * 1000);
        strikes = current + 1;
        localStrikeCache.set(ip, strikes, { ttl });
    }

    // If directBlock or strikes >= 3 -> Blocked (Tier 3)
    let tierConfig = JAIL_TIERS.RESTRICTED;
    if (directBlock || strikes >= 3) {
        tierConfig = JAIL_TIERS.BLOCKED;
    } else if (strikes === 2) {
        tierConfig = JAIL_TIERS.QUARANTINE;
    }

    const now = Date.now();
    let durationSeconds = tierConfig.durationSeconds;
    let expiresAt = now + (durationSeconds * 1000);
    let status = tierConfig.status;
    let finalReason = reason;
    let finalMeta = { ...meta };

    // Flaw 1.3 & 1.4: Check if existing jail entry has a longer ban (e.g. manual admin ban for 7-30 days)
    // Differentiate between Redis key missing/expired (record === null) and Redis offline/error (record === undefined)
    let existingRecord = undefined;
    try {
        const redis = getRedisClient();
        if (redis) {
            existingRecord = await redisGet(statusKey);
        }
    } catch (err) {
        logger.warn(`[RestrictedZone] Existing status check failed for ${ip}: ${err.message}`);
        existingRecord = undefined;
    }

    if (existingRecord === null) {
        // Key was explicitly deleted or naturally expired in Redis; purge local pod cache to prevent desync
        localJailCache.delete(ip);
        existingRecord = null;
    } else if (existingRecord === undefined) {
        // Only fall back to local in-memory cache if Redis was unreachable
        existingRecord = localJailCache.get(ip);
    }

    if (existingRecord && existingRecord.expiresAt && existingRecord.expiresAt > expiresAt) {
        // Preserve the longer expiration and stricter status
        expiresAt = existingRecord.expiresAt;
        durationSeconds = Math.max(1, Math.ceil((expiresAt - now) / 1000));
        if (existingRecord.status === 'blocked' || (existingRecord.status === 'quarantine' && status === 'restricted')) {
            status = existingRecord.status;
        }
        if (existingRecord.reason) {
            finalReason = existingRecord.reason;
        }
        if (existingRecord.meta) {
            finalMeta = { ...existingRecord.meta, ...meta };
        }
        if (typeof existingRecord.strikes === 'number') {
            strikes = Math.max(strikes, existingRecord.strikes);
        }
    }

    const payload = {
        ip,
        status,
        strikes,
        reason: finalReason,
        meta: finalMeta,
        createdAt: existingRecord?.createdAt || now,
        expiresAt,
    };

    // Store in local cache
    localJailCache.set(ip, payload, { ttl: durationSeconds * 1000 });

    // Store in Redis
    try {
        const redis = getRedisClient();
        if (redis) {
            await redisSet(statusKey, durationSeconds, payload);
        }
    } catch (err) {
        logger.warn(`[RestrictedZone] Redis set status failed for ${ip}: ${err.message}`);
    }

    logger.warn(`[RestrictedZone] ⚠️ IP ${ip} placed in ${status.toUpperCase()} (Strikes: ${strikes}, Reason: ${finalReason}, Duration: ${durationSeconds}s)`);

    return {
        status,
        strikes,
        durationSeconds,
        expiresAt,
    };
};

/**
 * Sub-second sliding-window burst click detector for short link redirects.
 * Increments click count within a 2-second window. If > 5 clicks occur within 2s,
 * triggers an automated strike and flags as bot traffic.
 * Keyed per shortId to prevent false positives on shared NATs (campus Wi-Fi, CGNAT).
 * 
 * @param {string} rawIp
 * @param {string} [shortId='default']
 * @returns {Promise<{ isBurst: boolean, count: number, jailStatus?: object }>}
 */
export const recordClickBurst = async (rawIp, shortId = 'default') => {
    const ip = formatPreferredIP(rawIp);
    if (!ip || isWhitelisted(ip)) {
        return { isBurst: false, count: 1 };
    }

    const safeShortId = String(shortId || 'default').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default';
    const burstKey = `ls:burst:click:${ip}:${safeShortId}`;
    const localKey = `${ip}:${safeShortId}`;
    let clickCount;

    try {
        const redis = getRedisClient();
        let res = null;
        if (redis) {
            res = await redisIncr(burstKey, BURST_CONFIG.CLICK_WINDOW_SEC);
        }
        if (typeof res === 'number') {
            clickCount = res;
        } else {
            const current = localBurstCache.get(localKey) || 0;
            const remainingTtl = localBurstCache.getRemainingTTL(localKey);
            const ttl = (remainingTtl && remainingTtl > 0) ? remainingTtl : (BURST_CONFIG.CLICK_WINDOW_SEC * 1000);
            clickCount = current + 1;
            localBurstCache.set(localKey, clickCount, { ttl });
        }
    } catch (err) {
        logger.warn(`[RestrictedZone] Burst counter error for ${ip}: ${err.message}`);
        const current = localBurstCache.get(localKey) || 0;
        const remainingTtl = localBurstCache.getRemainingTTL(localKey);
        const ttl = (remainingTtl && remainingTtl > 0) ? remainingTtl : (BURST_CONFIG.CLICK_WINDOW_SEC * 1000);
        clickCount = current + 1;
        localBurstCache.set(localKey, clickCount, { ttl });
    }

    const isBurst = clickCount > BURST_CONFIG.CLICK_THRESHOLD;

    // Issue 2.2: Only escalate strike on initial threshold breach (CLICK_THRESHOLD + 1),
    // to avoid penalizing multiple strikes for subsequent clicks during the same burst window!
    let jailStatus = null;
    if (clickCount === BURST_CONFIG.CLICK_THRESHOLD + 1) {
        jailStatus = await recordViolation(ip, 'burst_clicks', {
            shortId: safeShortId,
            clicksInWindow: clickCount,
            threshold: BURST_CONFIG.CLICK_THRESHOLD,
            windowSeconds: BURST_CONFIG.CLICK_WINDOW_SEC,
        });
    }

    return {
        isBurst,
        count: clickCount,
        ...(jailStatus ? { jailStatus } : {}),
    };
};

/**
 * Rate throttle check for IPs currently in RESTRICTED or QUARANTINE tier.
 * Returns true if request is allowed, false if request should be throttled.
 * 
 * @param {string} ip
 * @param {string} status - 'restricted' | 'quarantine'
 * @returns {Promise<{ allowed: boolean, remaining: number, retryAfterSeconds: number }>}
 */
export const checkRestrictedRate = async (ip, status) => {
    const tier = status === 'quarantine' ? JAIL_TIERS.QUARANTINE : JAIL_TIERS.RESTRICTED;
    const throttleKey = `ls:jail:throt:${ip}`;
    let count;

    try {
        const redis = getRedisClient();
        let res = null;
        if (redis) {
            res = await redisIncr(throttleKey, tier.windowSeconds);
        }
        if (typeof res === 'number') {
            count = res;
        } else {
            const current = localThrottleCache.get(ip) || 0;
            const remainingTtl = localThrottleCache.getRemainingTTL(ip);
            const ttl = (remainingTtl && remainingTtl > 0) ? remainingTtl : (tier.windowSeconds * 1000);
            count = current + 1;
            localThrottleCache.set(ip, count, { ttl });
        }
    } catch {
        const current = localThrottleCache.get(ip) || 0;
        const remainingTtl = localThrottleCache.getRemainingTTL(ip);
        const ttl = (remainingTtl && remainingTtl > 0) ? remainingTtl : (tier.windowSeconds * 1000);
        count = current + 1;
        localThrottleCache.set(ip, count, { ttl });
    }

    if (count > tier.maxReqPerWindow) {
        return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds: tier.windowSeconds,
        };
    }

    return {
        allowed: true,
        remaining: Math.max(0, tier.maxReqPerWindow - count),
        retryAfterSeconds: 0,
    };
};

/**
 * Manually unjail an IP (admin function).
 * 
 * @param {string} rawIp
 * @returns {Promise<{ success: boolean, ip: string }>}
 */
export const releaseIP = async (rawIp) => {
    const ip = formatPreferredIP(rawIp);
    if (!ip) return { success: false, ip: rawIp };

    localJailCache.delete(ip);
    localStrikeCache.delete(ip);
    localThrottleCache.delete(ip);

    // Clear all in-memory burst keys for this IP
    for (const k of localBurstCache.keys()) {
        if (k.startsWith(`${ip}:`) || k === ip) {
            localBurstCache.delete(k);
        }
    }

    try {
        await redisDel(
            `ls:jail:status:${ip}`,
            `ls:jail:strikes:${ip}`,
            `ls:jail:throt:${ip}`
        );

        const redis = getRedisClient();
        if (redis) {
            const [, burstKeys] = await redisScan('0', `ls:burst:click:${ip}:*`, 100);
            if (burstKeys && burstKeys.length > 0) {
                await redisDel(...burstKeys);
            }
        }
    } catch (err) {
        logger.warn(`[RestrictedZone] Redis del failed during release for ${ip}: ${err.message}`);
    }

    logger.info(`[RestrictedZone] ✅ Admin released IP ${ip} from jail`);
    return { success: true, ip };
};

/**
 * Manually place an IP into jail (admin function).
 * 
 * @param {string} rawIp
 * @param {number} durationSeconds
 * @param {string} reason
 * @param {'restricted'|'quarantine'|'blocked'} [status='blocked']
 * @returns {Promise<object>}
 */
export const manualJailIP = async (rawIp, durationSeconds = 86400, reason = 'admin_manual_ban', status = 'blocked') => {
    const ip = formatPreferredIP(rawIp);
    if (!ip) throw new Error('Invalid IP address provided');
    if (isWhitelisted(ip)) throw new Error('Cannot jail whitelisted IP address');

    const now = Date.now();
    const expiresAt = now + (durationSeconds * 1000);

    const payload = {
        ip,
        status,
        strikes: status === 'blocked' ? 3 : (status === 'quarantine' ? 2 : 1),
        reason,
        meta: { manual: true, adminEnforced: true },
        createdAt: now,
        expiresAt,
    };

    localJailCache.set(ip, payload, { ttl: durationSeconds * 1000 });

    try {
        await redisSet(`ls:jail:status:${ip}`, durationSeconds, payload);
    } catch (err) {
        logger.warn(`[RestrictedZone] Redis set failed during manual jail for ${ip}: ${err.message}`);
    }

    logger.warn(`[RestrictedZone] 🔒 Admin manually jailed IP ${ip} as ${status.toUpperCase()} for ${durationSeconds}s`);
    return payload;
};

/**
 * List all active jailed IPs across Redis and local cache (admin function).
 * 
 * @returns {Promise<Array<object>>}
 */
export const listJailedIPs = async () => {
    const map = new Map();
    const redis = getRedisClient();

    // 1. Gather from Redis if available (distributed single source of truth)
    if (redis) {
        try {
            let cursor = '0';
            do {
                const [nextCursor, keys] = await redisScan(cursor, 'ls:jail:status:*', 100);
                cursor = nextCursor;

                for (const key of keys) {
                    const data = await redisGet(key);
                    if (data && data.ip && data.expiresAt > Date.now()) {
                        map.set(data.ip, {
                            ...data,
                            remainingSeconds: Math.max(0, Math.ceil((data.expiresAt - Date.now()) / 1000)),
                        });
                    }
                }
            } while (cursor !== '0' && cursor !== 0);

            // Purge any stale entries in local pod cache that are no longer active in Redis
            for (const [ip] of localJailCache.entries()) {
                if (!map.has(ip)) {
                    localJailCache.delete(ip);
                }
            }
        } catch (err) {
            logger.warn(`[RestrictedZone] Redis scan failed during listJailedIPs: ${err.message}`);
        }
    }

    // 2. If Redis is unavailable or returned no entries, gather from local in-memory cache
    if (map.size === 0) {
        for (const [ip, entry] of localJailCache.entries()) {
            if (entry && entry.expiresAt > Date.now()) {
                map.set(ip, {
                    ...entry,
                    remainingSeconds: Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000)),
                });
            }
        }
    }

    return Array.from(map.values()).sort((a, b) => b.expiresAt - a.expiresAt);
};

export default {
    JAIL_TIERS,
    isWhitelisted,
    checkJailStatus,
    recordViolation,
    recordClickBurst,
    checkRestrictedRate,
    releaseIP,
    manualJailIP,
    listJailedIPs,
};
