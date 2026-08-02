import Redis from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';
import logger from '../utils/logger.js';

let redisClient = null;
let redisDriver = null;

let connectionPromise = null;

export const isRedisConfigured = () => true; // Always attempt connection (TCP fallback -> Upstash -> Memory)

export const connectRedis = async () => {
    if (redisClient) return redisClient;
    if (connectionPromise) return connectionPromise;

    connectionPromise = (async () => {
        // 1. Prefer Local or explicit TCP Redis first
        const tcpUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`;
        
        try {
            logger.info(`[Redis] Attempting TCP connection to ${tcpUrl}...`);
            const client = new Redis(tcpUrl, {
                // ioredis v6 defaults to RESP3 (HELLO 3). If your proxy doesn't support it, uncomment the line below.
                // protocol: 2, 
                enableReadyCheck: true,
                maxRetriesPerRequest: 1, // Only retry once during probing
                retryStrategy: (times) => {
                    if (times > 0) return null; // Stop retrying immediately if probe fails
                    return 0; 
                }
            });

            // Wait for connection to succeed or fail
            await new Promise((resolve, reject) => {
                const onReady = () => {
                    client.removeListener('error', onError);
                    resolve();
                };
                const onError = (err) => {
                    client.removeListener('ready', onReady);
                    reject(err);
                };
                client.once('ready', onReady);
                client.once('error', onError);
            });

            // Success! Reconfigure for normal resilient operation
            client.options.maxRetriesPerRequest = 3;
            client.options.retryStrategy = (times) => Math.min(times * 200, 5000);
            
            // Programmatically enforce noeviction to prevent BullMQ job loss and warnings
            try {
                await client.config('SET', 'maxmemory-policy', 'noeviction');
            } catch (configErr) {
                logger.warn('[Redis] Could not set maxmemory-policy to noeviction. If using managed Redis, ignore this. ' + configErr.message);
            }
            
            client.on('error', (err) => {
                if (err.code === 'ECONNREFUSED' && !process.env.REDIS_URL && !process.env.REDIS_HOST) return; // Mute log noise locally
                logger.warn('[Redis] TCP client error: ' + err.message);
            });

            redisClient = client;
            redisDriver = 'tcp';
            logger.info('[Redis] TCP Redis client initialised and connected.');
            return redisClient;
        } catch (err) {
            logger.warn(`[Redis] TCP connection to ${tcpUrl} failed: ${err.message}. Falling back...`);
        }

        // 2. Try Upstash HTTP REST fallback if TCP failed
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
            }
        }

        // 3. Complete Fallback
        logger.warn('[Redis] No Redis configuration succeeded. Running in-memory fallbacks.');
        redisClient = null;
        redisDriver = null;
        connectionPromise = null; // Reset so the next call can retry (e.g. after a K8s Redis sidecar starts)
        return null;
    })();

    return connectionPromise;
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
    const client = redisClient;
    if (!client) return undefined;
    try {
        const raw = await client.get(key);
        return raw === null ? null : deserialize(raw);
    } catch (err) {
        logger.warn('[Redis] GET ' + key + ' failed: ' + err.message);
        return undefined;
    }
};

export const redisSet = async (key, ttlSeconds, value) => {
    const client = redisClient;
    if (!client) return;
    try {
        const payload = getRedisDriver() === 'tcp' && typeof value !== 'string' 
            ? JSON.stringify(value) 
            : value;
        await client.setex(key, ttlSeconds, payload);
    } catch (err) {
        logger.warn('[Redis] SET ' + key + ' failed: ' + err.message);
    }
};

export const redisDel = async (...keys) => {
    const client = redisClient;
    if (!client || keys.length === 0) return;
    try {
        await client.del(...keys);
    } catch (err) {
        logger.warn('[Redis] DEL ' + keys.join(',') + ' failed: ' + err.message);
    }
};

export const redisIncr = async (key, safetyTtlSeconds = 604800) => {
    const client = redisClient;
    if (!client) return null;
    try {
        const count = await client.incr(key);
        if (count === 1) await client.expire(key, safetyTtlSeconds);
        return count;
    } catch (err) {
        logger.warn('[Redis] INCR ' + key + ' failed: ' + err.message);
        return null;
    }
};

export const redisGetDel = async (key) => {
    const client = redisClient;
    if (!client) return undefined;
    try {
        // Both ioredis (since 6.2+) and Upstash Redis support GETDEL natively
        const raw = await client.getdel(key);
        return raw === null ? null : deserialize(raw);
    } catch (err) {
        logger.warn('[Redis] GETDEL ' + key + ' failed: ' + err.message);
        return undefined;
    }
};

export const redisScan = async (cursor, matchPattern, count = 100) => {
    const client = redisClient;
    if (!client) return [0, []];
    try {
        if (redisDriver === 'tcp') {
            return await client.scan(cursor, 'MATCH', matchPattern, 'COUNT', count);
        } else {
            return await client.scan(cursor, { match: matchPattern, count });
        }
    } catch (err) {
        logger.warn('[Redis] SCAN failed: ' + err.message);
        return [0, []];
    }
};

// Export functions for external use

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
    safeScan: redisScan,
};
