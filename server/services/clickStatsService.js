import Url from '../models/Url.js';
import User from '../models/User.js';
import { redisIncr, redisGetDel, getRedisClient, redisScan } from '../config/redis.js';

// Buffer configuration
const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 5000; // 5 seconds
let clickBuffer = new Map(); // Map<urlId, count> (Fallback)
let userClickBuffer = new Map(); // Map<userId, count> (Fallback)
let flushTimer = null;
let isFlushing = false;

/**
 * Flushes the buffered click counts to the database using bulkWrite
 */
const flushBuffer = async () => {
    if (isFlushing) return;

    const redis = getRedisClient();
    const urlOps = [];
    const userOps = [];

    isFlushing = true;

    try {
        if (redis) {
            // --- Process URL Clicks from Redis ---
            let urlCursor = 0;
            do {
                const [nextCursor, keys] = await redisScan(urlCursor, 'ls:click:url:*', 100);
                if (keys && keys.length > 0) {
                    for (const key of keys) {
                        const count = await redisGetDel(key);
                        if (count) {
                            const urlId = key.replace('ls:click:url:', '');
                            urlOps.push({
                                updateOne: {
                                    filter: { _id: urlId },
                                    update: { $inc: { clicks: parseInt(count, 10) } }
                                }
                            });
                        }
                    }
                }
                urlCursor = Number(nextCursor) === 0 ? 0 : nextCursor;
            } while (urlCursor !== 0);

            // --- Process User Clicks from Redis ---
            let userCursor = 0;
            do {
                const [nextCursor, keys] = await redisScan(userCursor, 'ls:click:user:*', 100);
                if (keys && keys.length > 0) {
                    for (const key of keys) {
                        const count = await redisGetDel(key);
                        if (count) {
                            const userId = key.replace('ls:click:user:', '');
                            userOps.push({
                                updateOne: {
                                    filter: { _id: userId },
                                    update: { $inc: { 'clickUsage.count': parseInt(count, 10) } }
                                }
                            });
                        }
                    }
                }
                userCursor = Number(nextCursor) === 0 ? 0 : nextCursor;
            } while (userCursor !== 0);
        } else {
            // --- Fallback: Process URL Clicks from in-memory Map ---
            if (clickBuffer.size > 0) {
                const urlBufferToProcess = new Map(clickBuffer);
                clickBuffer.clear();

                for (const [urlId, count] of urlBufferToProcess) {
                    urlOps.push({
                        updateOne: {
                            filter: { _id: urlId },
                            update: { $inc: { clicks: count } }
                        }
                    });
                }
            }

            // --- Fallback: Process User Clicks from in-memory Map ---
            if (userClickBuffer.size > 0) {
                const userBufferToProcess = new Map(userClickBuffer);
                userClickBuffer.clear();

                for (const [userId, count] of userBufferToProcess) {
                    userOps.push({
                        updateOne: {
                            filter: { _id: userId },
                            update: { $inc: { 'clickUsage.count': count } }
                        }
                    });
                }
            }
        }

        // --- Execute Bulk Writes ---
        if (urlOps.length > 0 || userOps.length > 0) {
            try {
                const promises = [];
                if (urlOps.length > 0) {
                    promises.push(Url.bulkWrite(urlOps, { ordered: false }));
                }
                if (userOps.length > 0) {
                    promises.push(User.bulkWrite(userOps, { ordered: false }));
                }
                await Promise.all(promises);
            } catch (dbError) {
                console.error('[ClickStats] DB write failed. Restoring data...', dbError.message);
                if (redis) {
                    // Restore to Redis (atomic incrby + safety TTL)
                    for (const op of urlOps) {
                        try {
                            const urlId = op.updateOne.filter._id;
                            const count = op.updateOne.update.$inc.clicks;
                            const key = `ls:click:url:${urlId}`;
                            const newCount = await redis.incrby(key, count);
                            if (newCount === count) {
                                await redis.expire(key, 604800); // 7 days safety TTL
                            }
                        } catch (redisErr) {
                            console.error('[ClickStats] Failed to restore URL clicks to Redis:', redisErr.message);
                        }
                    }
                    for (const op of userOps) {
                        try {
                            const userId = op.updateOne.filter._id;
                            const count = op.updateOne.update.$inc['clickUsage.count'];
                            const key = `ls:click:user:${userId}`;
                            const newCount = await redis.incrby(key, count);
                            if (newCount === count) {
                                await redis.expire(key, 604800); // 7 days safety TTL
                            }
                        } catch (redisErr) {
                            console.error('[ClickStats] Failed to restore User clicks to Redis:', redisErr.message);
                        }
                    }
                } else {
                    // Restore to in-memory buffers
                    for (const op of urlOps) {
                        const urlId = op.updateOne.filter._id;
                        const count = op.updateOne.update.$inc.clicks;
                        clickBuffer.set(urlId, (clickBuffer.get(urlId) || 0) + count);
                    }
                    for (const op of userOps) {
                        const userId = op.updateOne.filter._id;
                        const count = op.updateOne.update.$inc['clickUsage.count'];
                        userClickBuffer.set(userId, (userClickBuffer.get(userId) || 0) + count);
                    }
                }
            }
        }
    } catch (error) {
        console.error('[ClickStats] Flush Error:', error);
    } finally {
        isFlushing = false;
    }
};

/**
 * Starts the flush timer
 */
const startFlushTimer = () => {
    if (!flushTimer) {
        flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL);
    }
};

startFlushTimer();

/**
 * Queues a click increment for a specific URL
 * @param {string} urlId - The MongoDB _id of the URL
 */
export const queueClickIncrement = async (urlId) => {
    try {
        const idStr = urlId.toString();
        const redis = getRedisClient();

        if (redis) {
            // Atomic increment with a 7-day safety TTL to protect against eviction
            await redisIncr(`ls:click:url:${idStr}`, 604800);
        } else {
            // Fallback in-memory Map
            const currentCheck = clickBuffer.get(idStr) || 0;
            clickBuffer.set(idStr, currentCheck + 1);

            // Immediate flush if buffer gets too large
            if (clickBuffer.size >= BATCH_SIZE) {
                if (!isFlushing) {
                    clearInterval(flushTimer);
                    await flushBuffer();
                    flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL);
                }
            }
        }
    } catch (error) {
        console.error('[ClickStats] Queue Error:', error);
    }
};

/**
 * Queues a click increment for a specific User
 * @param {string} userId - The MongoDB _id of the User
 */
export const queueUserClickIncrement = async (userId) => {
    try {
        const idStr = userId.toString();
        const redis = getRedisClient();

        if (redis) {
            // Atomic increment with a 7-day safety TTL to protect against eviction
            await redisIncr(`ls:click:user:${idStr}`, 604800);
        } else {
            // Fallback in-memory Map
            const current = userClickBuffer.get(idStr) || 0;
            userClickBuffer.set(idStr, current + 1);

            if (userClickBuffer.size >= BATCH_SIZE) {
                if (!isFlushing) {
                    clearInterval(flushTimer);
                    await flushBuffer();
                    flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL);
                }
            }
        }
    } catch (error) {
        console.error('[ClickStats] User Queue Error:', error);
    }
};

/**
 * Flush all pending click counts to DB and stop the timer.
 * Call this during graceful shutdown to prevent data loss.
 */
export const flushAndStop = async () => {
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
    }
    await flushBuffer();
};
