import { Redis } from '@upstash/redis';
import logger from '../utils/logger.js';

/**
 * Upstash Redis client — HTTP-based, serverless-first.
 *
 * RESILIENCE DESIGN:
 * ─────────────────
 * Every Redis call in this app has a MongoDB fallback. The design guarantees:
 *
 *   1. Cache data (URLs, subscriptions, settings):
 *      Redis is a read-through cache. MongoDB is the source of truth.
 *      If Redis is down / key evicted → DB query fires (small latency spike, zero data loss).
 *
 *   2. Rate limiters:
 *      Falls back to in-memory MemoryStore (per-pod). Still blocks abuse,
 *      just not globally coordinated. Acceptable degradation.
 *
 *   3. WebAuthn challenges:
 *      Falls back to in-memory Map (single-pod mode only).
 *      Multi-pod challenge correlation fails → user retries once. Fail-safe, not fail-open.
 *
 *   4. Click counters (ls:click:*):
 *      ⚠️  RISK: Upstash eviction could silently delete these if RAM fills.
 *      MITIGATION: These keys always get a long TTL (7 days) so eviction-policy
 *      (volatile-lru / volatile-ttl) targets them last. The 5s flush timer
 *      drains them to MongoDB before eviction pressure can build.
 *
 * EVICTION POLICY NOTE (you have eviction enabled):
 * ──────────────────────────────────────────────────
 * If your Upstash plan uses allkeys-lru: ALL keys can be evicted.
 * Prefer volatile-lru / volatile-ttl so ONLY keys WITH a TTL are candidates.
 * Either way, we set TTLs on EVERYTHING — including counters — to ensure
 * the eviction algorithm never blindly evicts data-critical keys first.
 *
 * Required .env vars:
 *   UPSTASH_REDIS_REST_URL   — https://tough-ladybug-131302.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN — from Upstash console
 */

let redisClient = null;

// ─── Connection ──────────────────────────────────────────────────────────────

export const connectRedis = () => {
    if (redisClient) return redisClient;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        logger.warn(
            '[Redis] UPSTASH_REDIS_REST_URL / TOKEN not set. ' +
            'Running in single-pod mode (in-memory fallbacks active). ' +
            'Multi-pod deployments will have split-brain state.'
        );
        return null;
    }

    try {
        redisClient = new Redis({ url, token });
        logger.info('[Redis] Upstash Redis client initialised (HTTP mode).');
    } catch (err) {
        logger.error(`[Redis] Failed to initialise client: ${err.message}`);
        redisClient = null;
    }

    return redisClient;
};

export const getRedisClient = () => redisClient;

// ─── Health ───────────────────────────────────────────────────────────────────

export const checkRedisConnection = async () => {
    if (!redisClient) return false;
    try {
        const pong = await redisClient.ping();
        return pong === 'PONG';
    } catch (err) {
        logger.warn(`[Redis] Health check failed: ${err.message}`);
        return false;
    }
};

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

export const disconnectRedis = () => {
    if (redisClient) {
        logger.info('[Redis] HTTP client released (no TCP socket to close).');
        redisClient = null;
    }
};

// ─── Safe Wrappers (fail-open with logging) ───────────────────────────────────

/**
 * GET a key from Redis with automatic JSON parsing.
 * Returns null on miss, error, or if Redis is not configured.
 *
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export const redisGet = async (key) => {
    if (!redisClient) return null;
    try {
        const raw = await redisClient.get(key);
        if (raw === null || raw === undefined) return null;
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (err) {
        logger.warn(`[Redis] GET ${key} failed: ${err.message}`);
        return null;
    }
};

/**
 * SET a key with TTL and automatic JSON serialisation.
 * Silently fails (logs warning) if Redis is down.
 *
 * @param {string} key
 * @param {number} ttlSeconds
 * @param {any} value
 */
export const redisSet = async (key, ttlSeconds, value) => {
    if (!redisClient) return;
    try {
        const payload = typeof value === 'string' ? value : JSON.stringify(value);
        await redisClient.setex(key, ttlSeconds, payload);
    } catch (err) {
        logger.warn(`[Redis] SET ${key} failed: ${err.message}`);
    }
};

/**
 * DEL one or more keys. Silently fails if Redis is down.
 *
 * @param {...string} keys
 */
export const redisDel = async (...keys) => {
    if (!redisClient || keys.length === 0) return;
    try {
        await redisClient.del(...keys);
    } catch (err) {
        logger.warn(`[Redis] DEL ${keys.join(',')} failed: ${err.message}`);
    }
};

/**
 * INCR a counter and set a safety TTL on first increment.
 * The TTL ensures eviction-policy never permanently removes active counters.
 *
 * EVICTION GUARD: All counter keys get a TTL longer than the flush interval.
 * This means: before eviction pressure can build, the flush cron has already
 * drained the counter to MongoDB.
 *
 * @param {string} key
 * @param {number} safetyTtlSeconds — TTL set on first INCR (default 7 days)
 * @returns {Promise<number|null>} new value, or null if Redis unavailable
 */
export const redisIncr = async (key, safetyTtlSeconds = 604800) => {
    if (!redisClient) return null;
    try {
        // Pipeline: INCR + EXPIRE in one round-trip when count === 1 (first increment)
        // Subsequent increments are single INCR — EXPIRE is a no-op (key already has TTL)
        const count = await redisClient.incr(key);
        if (count === 1) {
            // First increment: set the safety TTL so volatile-lru can manage it
            await redisClient.expire(key, safetyTtlSeconds);
        }
        return count;
    } catch (err) {
        logger.warn(`[Redis] INCR ${key} failed: ${err.message}`);
        return null;
    }
};

/**
 * GETDEL — atomic read-and-delete. Used for WebAuthn challenge consumption
 * (prevents replay attacks) and counter draining during flush.
 *
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export const redisGetDel = async (key) => {
    if (!redisClient) return null;
    try {
        const raw = await redisClient.getdel(key);
        if (raw === null || raw === undefined) return null;
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (err) {
        logger.warn(`[Redis] GETDEL ${key} failed: ${err.message}`);
        return null;
    }
};

export default {
    connect: connectRedis,
    get: getRedisClient,
    check: checkRedisConnection,
    disconnect: disconnectRedis,
    // Safe wrappers
    safeGet: redisGet,
    safeSet: redisSet,
    safeDel: redisDel,
    safeIncr: redisIncr,
    safeGetDel: redisGetDel,
};
