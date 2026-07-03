import { Redis } from '@upstash/redis';
import logger from '../utils/logger.js';

/**
 * Upstash Redis client — HTTP-based, serverless-first.
 *
 * No TCP socket to manage. The SDK auto-handles:
 *  - Connection pooling (HTTP/2)
 *  - Retries with exponential backoff
 *  - TLS (enforced by Upstash by default)
 *
 * Required .env vars:
 *   UPSTASH_REDIS_REST_URL   — from Upstash console (e.g. https://...upstash.io)
 *   UPSTASH_REDIS_REST_TOKEN — from Upstash console (long JWT-style token)
 *
 * When NOT set: all cache/rate-limit logic falls back to local in-memory
 * (single-pod mode — fine for local dev, breaks horizontal scaling).
 */

let redisClient = null;

/**
 * Initialise the Upstash Redis client.
 * Safe to call multiple times — returns existing client if already created.
 *
 * @returns {Redis|null} Redis client or null if not configured
 */
export const connectRedis = () => {
    if (redisClient) return redisClient; // Already initialised

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

/**
 * Get the active Redis client (or null if not configured).
 * Import this wherever you need Redis access.
 *
 * Pattern:
 *   const redis = getRedisClient();
 *   if (!redis) { // use in-memory fallback }
 */
export const getRedisClient = () => redisClient;

/**
 * Ping Upstash to verify connectivity.
 * Used by /api/health/deep endpoint.
 *
 * @returns {Promise<boolean>} true = reachable, false = down or not configured
 */
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

/**
 * Graceful shutdown — Upstash is HTTP-based so there is no persistent
 * TCP socket to close. This is a no-op stub kept for API parity with
 * ioredis-style teardown flows and to satisfy the shutdown handler.
 */
export const disconnectRedis = () => {
    if (redisClient) {
        logger.info('[Redis] HTTP client released (no TCP socket to close).');
        redisClient = null;
    }
};

export default {
    connect: connectRedis,
    get: getRedisClient,
    check: checkRedisConnection,
    disconnect: disconnectRedis,
};
