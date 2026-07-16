import crypto from 'crypto';
import { getRedisClient, getRedisDriver } from '../config/redis.js';
import User from '../models/User.js';
import Url from '../models/Url.js';
import logger from '../utils/logger.js';

// Configuration for Bloom Filters
// 1,000,000 capacity, 1% false positive rate -> m = 9,585,058 bits (~1.2MB), k = 7
const BF_SIZE_BITS = 10000000;
const BF_HASH_COUNT = 7;

const KEYS = {
    usernames: 'ls:bf:usernames',
    urls: 'ls:bf:urls',
    seeded: 'ls:bf:seeded',
    lock: 'ls:lock:bf:seeding'
};

/**
 * Generate k bit offsets for a given string using MD5 hashes.
 */
const getOffsets = (value, filterName, size = BF_SIZE_BITS, k = BF_HASH_COUNT) => {
    // Usernames are case-insensitive; URLs/aliases are case-sensitive
    const normalized = filterName === 'usernames'
        ? String(value).toLowerCase().trim()
        : String(value).trim();
        
    const offsets = [];
    const hashCount = Math.ceil(k / 4);
    
    for (let i = 0; i < hashCount; i++) {
        const hash = crypto.createHash('md5').update(`${normalized}:${i}`).digest();
        for (let j = 0; j < 4 && offsets.length < k; j++) {
            const offset = hash.readUInt32LE(j * 4) % size;
            offsets.push(offset);
        }
    }
    return offsets;
};

/**
 * Add a value to the specified Bloom Filter.
 */
export const bloomAdd = async (filterName, value) => {
    const redis = getRedisClient();
    if (!redis) return;

    const key = KEYS[filterName];
    if (!key) {
        logger.warn(`[BloomFilter] Unknown filter: ${filterName}`);
        return;
    }

    try {
        const offsets = getOffsets(value, filterName);
        const pipeline = redis.pipeline();
        offsets.forEach(offset => pipeline.setbit(key, offset, 1));
        await pipeline.exec();
    } catch (err) {
        logger.error(`[BloomFilter] Failed to add '${value}' to ${filterName}: ${err.message}`);
    }
};

/**
 * Check if a value probably exists in the specified Bloom Filter.
 * Returns true if it probably exists, false if it definitely does not.
 */
export const bloomExists = async (filterName, value) => {
    const redis = getRedisClient();
    if (!redis) return true; // Fail-secure (fall back to checking DB/cache)

    const key = KEYS[filterName];
    if (!key) return true;

    try {
        const offsets = getOffsets(value, filterName);
        const pipeline = redis.pipeline();
        offsets.forEach(offset => pipeline.getbit(key, offset));
        const results = await pipeline.exec();
        
        if (!results) return true;

        return results.every(res => {
            const val = Array.isArray(res) ? res[1] : res;
            return val === 1;
        });
    } catch (err) {
        logger.error(`[BloomFilter] Error checking '${value}' in ${filterName}: ${err.message}`);
        return true; // Fail-secure (assume it exists so we query DB)
    }
};

/**
 * Stream records from MongoDB and seed the Bloom Filters.
 * Uses a Redis lock to ensure only one replica seeds the filters.
 */
export const seedBloomFilters = async (force = false) => {
    const redis = getRedisClient();
    if (!redis) {
        logger.warn('[BloomFilter] Redis is not connected. Skipping seeding.');
        return;
    }

    try {
        // 1. Check if already seeded
        const alreadySeeded = await redis.get(KEYS.seeded);
        if (alreadySeeded && !force) {
            logger.info('[BloomFilter] Filters are already seeded.');
            return;
        }

        // 2. Try to acquire the seeding lock (TTL of 10 minutes to prevent deadlocks)
        let lockAcquired = false;
        const driver = getRedisDriver();
        if (driver === 'upstash') {
            const res = await redis.set(KEYS.lock, 'locked', { nx: true, ex: 600 });
            lockAcquired = res === 'OK' || res === true || res === 1;
        } else if (typeof redis.set === 'function') {
            // ioredis TCP client
            const res = await redis.set(KEYS.lock, 'locked', 'EX', 600, 'NX');
            lockAcquired = res === 'OK' || res === true || res === 1;
        }

        if (!lockAcquired) {
            logger.info('[BloomFilter] Another instance is currently seeding. Skipping.');
            return;
        }

        logger.info('[BloomFilter] Starting Bloom Filter seeding...');

        // Create temporary filter keys for atomic swap (if force-rebuilding)
        const tempUserKey = `${KEYS.usernames}:temp`;
        const tempUrlKey = `${KEYS.urls}:temp`;

        // Clear any old temp keys first
        await redis.del(tempUserKey, tempUrlKey);

        // A. Seed Usernames
        logger.info('[BloomFilter] Seeding usernames...');
        const userCursor = User.find().select('username').cursor();
        let userPipeline = redis.pipeline();
        let userCount = 0;
        
        for (let user = await userCursor.next(); user != null; user = await userCursor.next()) {
            if (user.username) {
                const offsets = getOffsets(user.username, 'usernames');
                offsets.forEach(offset => userPipeline.setbit(tempUserKey, offset, 1));
                userCount++;
                
                if (userCount % 1000 === 0) {
                    await userPipeline.exec();
                    userPipeline = redis.pipeline();
                }
            }
        }
        await userPipeline.exec();
        logger.info(`[BloomFilter] Successfully seeded ${userCount} usernames.`);

        // B. Seed URLs (shortId and customAlias)
        logger.info('[BloomFilter] Seeding URLs...');
        const urlCursor = Url.find().select('shortId customAlias').cursor();
        let urlPipeline = redis.pipeline();
        let urlCount = 0;

        for (let url = await urlCursor.next(); url != null; url = await urlCursor.next()) {
            if (url.shortId) {
                const offsets = getOffsets(url.shortId, 'urls');
                offsets.forEach(offset => urlPipeline.setbit(tempUrlKey, offset, 1));
                urlCount++;
            }
            if (url.customAlias) {
                const offsets = getOffsets(url.customAlias, 'urls');
                offsets.forEach(offset => urlPipeline.setbit(tempUrlKey, offset, 1));
                urlCount++;
            }

            if (urlCount % 1000 === 0) {
                await urlPipeline.exec();
                urlPipeline = redis.pipeline();
            }
        }
        await urlPipeline.exec();
        logger.info(`[BloomFilter] Successfully seeded ${urlCount} URL identifiers.`);

        // C. Rename/Swap Keys atomically
        // ioredis and Upstash handle RENAME/RENAME command.
        // If the target key exists, it is overwritten atomically.
        if (userCount > 0) await redis.rename(tempUserKey, KEYS.usernames);
        if (urlCount > 0) await redis.rename(tempUrlKey, KEYS.urls);

        // Mark as seeded
        await redis.set(KEYS.seeded, 'true');
        logger.info('[BloomFilter] Seeding complete and persistent flag set.');

        // 3. Release lock
        await redis.del(KEYS.lock);

    } catch (err) {
        logger.error(`[BloomFilter] Seeding process failed: ${err.message}`);
        // Clean up locks/temp keys on failure
        const redis = getRedisClient();
        if (redis) {
            await redis.del(KEYS.lock, `${KEYS.usernames}:temp`, `${KEYS.urls}:temp`).catch(() => {});
        }
    }
};
