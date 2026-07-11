import Redis from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';
import logger from '../utils/logger.js';

let redisClient = null;
let redisDriver = null;

export const isRedisConfigured = () => Boolean(
    process.env.REDIS_URL ||
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
);

export const connectRedis = () => {
    if (redisClient) return redisClient;

    const tcpUrl = process.env.REDIS_URL;
    if (tcpUrl) {
        try {
            redisClient = new Redis(tcpUrl, {
                enableReadyCheck: true,
                maxRetriesPerRequest: 3,
            });
            redisDriver = 'tcp';
            redisClient.on('error', (err) => {
                logger.warn('[Redis] TCP client error: ' + err.message);
            });
            logger.info('[Redis] Local TCP Redis client initialised.');
            return redisClient;
        } catch (err) {
            logger.error('[Redis] Failed to initialise TCP client: ' + err.message);
            redisClient = null;
            redisDriver = null;
            return null;
        }
    }

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token) {
        try {
            redisClient = new UpstashRedis({ url, token });
            redisDriver = 'upstash';
            logger.info('[Redis] Upstash Redis client initialised (HTTP mode).');
            return redisClient;
        } catch (err) {
            logger.error('[Redis] Failed to initialise Upstash client: ' + err.message);
            redisClient = null;
            redisDriver = null;
            return null;
        }
    }

    logger.warn('[Redis] No Redis configuration found. Running in-memory fallbacks.');
    return null;
};

export const getRedisClient = () => redisClient;
export const getRedisDriver = () => redisDriver;

export const checkRedisConnection = async () => {
    if (!redisClient) return false;
    try {
        return (await redisClient.ping()) === 'PONG';
    } catch (err) {
        logger.warn('[Redis] Health check failed: ' + err.message);
        return false;
    }
};

export const disconnectRedis = async () => {
    if (!redisClient) return;

    const client = redisClient;
    const driver = redisDriver;
    redisClient = null;
    redisDriver = null;

    if (driver === 'tcp') {
        try {
            await client.quit();
            logger.info('[Redis] TCP client disconnected.');
        } catch (err) {
            logger.warn('[Redis] TCP disconnect failed: ' + err.message);
            client.disconnect();
        }
        return;
    }

    logger.info('[Redis] Upstash HTTP client released.');
};

const deserialize = (raw) => {
    if (raw === null || raw === undefined || typeof raw !== 'string') return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
};

export const redisGet = async (key) => {
    if (!redisClient) return null;
    try {
        return deserialize(await redisClient.get(key));
    } catch (err) {
        logger.warn('[Redis] GET ' + key + ' failed: ' + err.message);
        return null;
    }
};

export const redisSet = async (key, ttlSeconds, value) => {
    if (!redisClient) return;
    try {
        const payload = typeof value === 'string' ? value : JSON.stringify(value);
        await redisClient.setex(key, ttlSeconds, payload);
    } catch (err) {
        logger.warn('[Redis] SET ' + key + ' failed: ' + err.message);
    }
};

export const redisDel = async (...keys) => {
    if (!redisClient || keys.length === 0) return;
    try {
        await redisClient.del(...keys);
    } catch (err) {
        logger.warn('[Redis] DEL ' + keys.join(',') + ' failed: ' + err.message);
    }
};

export const redisIncr = async (key, safetyTtlSeconds = 604800) => {
    if (!redisClient) return null;
    try {
        const count = await redisClient.incr(key);
        if (count === 1) await redisClient.expire(key, safetyTtlSeconds);
        return count;
    } catch (err) {
        logger.warn('[Redis] INCR ' + key + ' failed: ' + err.message);
        return null;
    }
};

export const redisGetDel = async (key) => {
    if (!redisClient) return null;
    try {
        let raw;
        if (redisDriver === 'tcp') {
            // ioredis: use pipeline for atomic GET+DEL (works on Redis < 6.2 without GETDEL)
            // Redis >= 6.2 supports GETDEL natively; pipeline is safe for all versions
            const [[, getVal], [, delVal]] = await redisClient.pipeline()
                .get(key)
                .del(key)
                .exec();
            void delVal; // del result not needed
            raw = getVal;
        } else {
            // Upstash supports getdel natively via HTTP API
            raw = await redisClient.getdel(key);
        }
        return deserialize(raw);
    } catch (err) {
        logger.warn('[Redis] GETDEL ' + key + ' failed: ' + err.message);
        return null;
    }
};

export default {
    connect: connectRedis,
    get: getRedisClient,
    check: checkRedisConnection,
    disconnect: disconnectRedis,
    safeGet: redisGet,
    safeSet: redisSet,
    safeDel: redisDel,
    safeIncr: redisIncr,
    safeGetDel: redisGetDel,
};
