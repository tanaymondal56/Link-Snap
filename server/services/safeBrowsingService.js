/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LINK-SNAP GOOGLE SAFE BROWSING v5 SERVICE (NO-STORAGE REAL-TIME MODE)
 * ═══════════════════════════════════════════════════════════════════════════════
 * Implements Google Safe Browsing v5 No-Storage Real-Time Mode:
 * 1. RFC 2396 URL canonicalization and expression generation (up to 30 expressions).
 * 2. Privacy-preserving 4-byte SHA-256 hash prefix lookups via v5/hashes:search.
 * 3. Protobuf binary response parsing with dynamic cache duration respect.
 * 4. Resilient fallback to v4 Lookup API during transitions or temporary outages.
 * 5. Redis caching with TTL aligned to Google's cacheDuration.
 * 6. Batch reconciliation scanners for pending, unchecked, and stale links.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import crypto from 'node:crypto';
import axios from 'axios';
import Url from '../models/Url.js';
import { redisGet, redisSet, getRedisClient } from '../config/redis.js';
import { getSettings } from '../utils/getSettings.js';
import { invalidateCache } from './cacheService.js';
import { canonicalizeUrl, getUrlHashPrefixes } from '../utils/urlCanonicalizer.js';
import { decodeSearchHashesResponse } from '../utils/protoDecoder.js';
import logger from '../utils/logger.js';

const SAFE_BROWSING_V5_URL = 'https://safebrowsing.googleapis.com/v5/hashes:search';
const SAFE_BROWSING_V4_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

/**
 * Maps Safe Browsing threat types to Link-Snap internal safety status.
 * 
 * @param {string} threatType - Raw Google threat type
 * @returns {{ status: 'safe'|'phishing'|'malware'|'unwanted', details: string }}
 */
export const mapThreatToStatus = (threatType) => {
    if (!threatType) return { status: 'safe', details: null };
    const upper = threatType.toUpperCase();

    if (upper === 'SOCIAL_ENGINEERING') {
        return { status: 'phishing', details: 'Detected Social Engineering (Phishing)' };
    }
    if (upper === 'MALWARE' || upper === 'POTENTIALLY_HARMFUL_APPLICATION') {
        return { status: 'malware', details: 'Detected Malicious Software / Harmful Application' };
    }
    if (upper === 'UNWANTED_SOFTWARE') {
        return { status: 'unwanted', details: 'Detected Unwanted Software' };
    }
    return { status: 'malware', details: `Detected Security Threat (${threatType})` };
};

/**
 * Primary Google Safe Browsing v5 No-Storage Real-Time Mode Query
 * 
 * @param {string[]} urls - Array of candidate URLs
 * @param {number} timeoutMs - Max request timeout
 * @returns {Promise<{ threatMap: Map<string, string>, cacheDuration: number }>}
 */
const queryGoogleV5 = async (urls, timeoutMs = 2500) => {
    const apiKey = process.env.GOOGLE_SAFE_BROWSING_KEY;
    if (!apiKey || !urls.length) {
        return { threatMap: new Map(), cacheDuration: 300 };
    }

    // Step 1: Canonicalize and extract hash prefixes for all URLs
    const urlMeta = [];
    const allPrefixes = new Set();

    for (const url of urls) {
        try {
            const hashes = getUrlHashPrefixes(url);
            urlMeta.push({ url, hashes });
            for (const p of hashes.prefixes) {
                allPrefixes.add(p);
            }
        } catch (err) {
            logger.warn(`[SafeBrowsingV5] Canonicalization failed for ${url}: ${err.message}`);
        }
    }

    if (allPrefixes.size === 0) {
        return { threatMap: new Map(), cacheDuration: 300 };
    }

    // Cap at 1000 prefixes as mandated by Google specifications
    const prefixArray = Array.from(allPrefixes).slice(0, 1000);

    // Build URL query string with repeated hashPrefixes parameters
    const params = new URLSearchParams();
    params.set('key', apiKey);
    for (const prefix of prefixArray) {
        params.append('hashPrefixes', prefix);
    }

    const targetUrl = `${SAFE_BROWSING_V5_URL}?${params.toString()}`;

    // Step 2: Query Google Safe Browsing v5 with binary response
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await axios.get(targetUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Link-Snap/1.0.0 (https://lksnp.qzz.io)',
                'Accept': 'application/x-protobuf',
            },
            signal: controller.signal,
        });

        // Step 3: Decode Protobuf response
        const { fullHashes, cacheDurationSeconds } = decodeSearchHashesResponse(response.data);
        const threatMap = new Map();

        if (fullHashes.length > 0) {
            // Index returned full hashes by hex string
            const matchedHashMap = new Map();
            for (const fh of fullHashes) {
                const threat = fh.threatTypes[0] || 'MALWARE';
                matchedHashMap.set(fh.hashHex, threat);
            }

            // Step 4: Compare full hashes against each URL's computed full hashes
            for (const meta of urlMeta) {
                for (const [, fullHashBuf] of meta.hashes.fullHashes) {
                    const hashHex = fullHashBuf.toString('hex');
                    if (matchedHashMap.has(hashHex)) {
                        threatMap.set(meta.url, matchedHashMap.get(hashHex));
                        break;
                    }
                }
            }
        }

        return { threatMap, cacheDuration: cacheDurationSeconds || 300 };
    } finally {
        clearTimeout(timer);
    }
};

/**
 * Fallback to Google Safe Browsing v4 Lookup API
 * 
 * @param {string[]} urls - Array of candidate URLs
 * @param {number} timeoutMs - Max request timeout
 * @returns {Promise<{ threatMap: Map<string, string>, cacheDuration: number }>}
 */
const queryGoogleV4 = async (urls, timeoutMs = 2500) => {
    const apiKey = process.env.GOOGLE_SAFE_BROWSING_KEY;
    if (!apiKey || !urls.length) {
        return { threatMap: new Map(), cacheDuration: 300 };
    }

    const uniqueEntries = Array.from(new Set(urls)).map(url => ({ url }));
    const requestBody = {
        client: { clientId: 'link-snap', clientVersion: '1.0.0' },
        threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: uniqueEntries,
        },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await axios.post(`${SAFE_BROWSING_V4_URL}?key=${apiKey}`, requestBody, {
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
        });

        const matches = response.data.matches || [];
        const threatMap = new Map();
        matches.forEach(match => {
            threatMap.set(match.threat.url, match.threatType);
        });

        return { threatMap, cacheDuration: 300 };
    } finally {
        clearTimeout(timer);
    }
};

/**
 * Unified Google Safe Browsing Query (v5 Primary with v4 Fallback)
 * 
 * @param {string[]} urls - Array of URLs to query
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<{ threatMap: Map<string, string>, cacheDuration: number }>}
 */
const queryGoogleRef = async (urls, timeoutMs = 2500) => {
    if (!urls.length) return { threatMap: new Map(), cacheDuration: 300 };

    const apiKey = process.env.GOOGLE_SAFE_BROWSING_KEY;
    const settings = await getSettings();

    if (!apiKey || !settings?.safeBrowsingEnabled) {
        return { threatMap: new Map(), cacheDuration: 300 };
    }

    // Attempt Safe Browsing v5 No-Storage Real-Time Mode
    try {
        return await queryGoogleV5(urls, timeoutMs);
    } catch (v5Err) {
        logger.warn(`[SafeBrowsing] v5 lookup failed (${v5Err.message}), falling back to v4`);
        try {
            return await queryGoogleV4(urls, timeoutMs);
        } catch (v4Err) {
            logger.error(`[SafeBrowsing] Both v5 and v4 lookups failed: ${v4Err.message}`);
            throw v4Err;
        }
    }
};

/**
 * Check one or more URLs for safety with Redis Caching and bounded timeout.
 * 
 * @param {string|string[]} urls - Single URL or array of URLs to verify
 * @param {Object} [options] - Additional query options
 * @param {number} [options.timeoutMs=2500] - Timeout for external lookup
 * @returns {Promise<{ status: 'safe'|'phishing'|'malware'|'unwanted'|'pending', details: string|null }>}
 */
export const checkUrlsSafety = async (urls, options = {}) => {
    const timeoutMs = options.timeoutMs || 2500;

    try {
        const urlList = Array.isArray(urls) ? urls : [urls];
        const validUrls = urlList.filter(u => u && typeof u === 'string');

        if (validUrls.length === 0) {
            return { status: 'safe', details: null };
        }

        const redis = getRedisClient();
        const results = [];
        const nonCachedUrls = [];

        // Check Redis cache first (Sub-millisecond lookup)
        if (redis) {
            for (const url of validUrls) {
                try {
                    const { canonicalUrl } = canonicalizeUrl(url);
                    const hash = crypto.createHash('sha256').update(canonicalUrl).digest('hex');
                    const safeKey = `ls:sb:${hash}`;
                    const cached = await redisGet(safeKey);

                    if (cached && cached.status) {
                        results.push(cached);
                    } else {
                        nonCachedUrls.push(url);
                    }
                } catch {
                    nonCachedUrls.push(url);
                }
            }
        } else {
            nonCachedUrls.push(...validUrls);
        }

        // For non-cached URLs, query Google Safe Browsing
        if (nonCachedUrls.length > 0) {
            const { threatMap, cacheDuration } = await queryGoogleRef(nonCachedUrls, timeoutMs);

            for (const url of nonCachedUrls) {
                let status = 'safe';
                let details = null;

                if (threatMap.has(url)) {
                    const threat = threatMap.get(url);
                    const mapped = mapThreatToStatus(threat);
                    status = mapped.status;
                    details = mapped.details;
                }

                const result = { url, status, details };
                results.push(result);

                // Cache verdict in Redis
                if (redis) {
                    try {
                        const { canonicalUrl } = canonicalizeUrl(url);
                        const hash = crypto.createHash('sha256').update(canonicalUrl).digest('hex');
                        const safeKey = `ls:sb:${hash}`;
                        // Threats are cached for 24h; safe responses respect Google's dynamic cacheDuration
                        const ttl = status === 'safe' ? Math.max(cacheDuration, 300) : 86400;
                        await redisSet(safeKey, ttl, result);
                    } catch {
                        // Ignore cache write error
                    }
                }
            }
        }

        // Evaluate aggregate threat severity
        if (results.some(r => r.status === 'malware')) {
            const threat = results.find(r => r.status === 'malware');
            return { status: 'malware', details: threat.details || 'Detected Malware/Harmful Content' };
        }
        if (results.some(r => r.status === 'phishing')) {
            const threat = results.find(r => r.status === 'phishing');
            return { status: 'phishing', details: threat.details || 'Detected Social Engineering (Phishing)' };
        }
        if (results.some(r => r.status === 'unwanted')) {
            const threat = results.find(r => r.status === 'unwanted');
            return { status: 'unwanted', details: threat.details || 'Detected Unwanted Software' };
        }
        if (results.some(r => r.status === 'pending')) {
            return { status: 'pending', details: 'Verification pending' };
        }

        return { status: 'safe', details: null };
    } catch (error) {
        logger.error(`[SafeBrowsing] Check failed: ${error.message}`);
        return { status: 'pending', details: `Check Failed: ${error.message}` };
    }
};

/**
 * Legacy wrapper for single URL
 */
export const checkUrlSafety = (url, options) => checkUrlsSafety(url, options);

/**
 * Batch Scan Logic with Loop
 * Processes multiple batches to reconcile missed or unchecked links
 * 
 * @param {Object} query - Mongoose Filter Query
 * @param {number} maxLimit - Max items to process in this run
 * @returns {Promise<{ processed: number, threats: number, error?: string }>}
 */
const runBatchScan = async (query, maxLimit = 500) => {
    let processed = 0;
    let threats = 0;
    const BATCH_SIZE = 50;

    try {
        const settings = await getSettings();
        if (!settings?.safeBrowsingEnabled) {
            return { processed: 0, threats: 0, message: 'Feature disabled' };
        }

        while (processed < maxLimit) {
            const batchLimit = Math.min(BATCH_SIZE, maxLimit - processed);

            const urlsToCheck = await Url.find(query)
                .limit(batchLimit)
                .select('originalUrl deviceRedirects timeRedirects _id shortId customAlias');

            if (urlsToCheck.length === 0) break;

            const allThreatEntries = [];
            urlsToCheck.forEach(doc => {
                if (doc.originalUrl) allThreatEntries.push(doc.originalUrl);
                if (doc.deviceRedirects?.enabled && doc.deviceRedirects.rules) {
                    doc.deviceRedirects.rules.forEach(r => { if (r.url) allThreatEntries.push(r.url); });
                }
                if (doc.timeRedirects?.enabled && doc.timeRedirects.rules) {
                    doc.timeRedirects.rules.forEach(r => { if (r.destination) allThreatEntries.push(r.destination); });
                }
            });

            // Query Safe Browsing
            const { threatMap } = await queryGoogleRef(allThreatEntries, 5000);

            // Prepare atomic bulk operations
            const bulkOps = urlsToCheck.map((doc) => {
                let status = 'safe';
                let details = null;
                let foundThreat = null;

                if (threatMap.has(doc.originalUrl)) {
                    foundThreat = threatMap.get(doc.originalUrl);
                }
                if (!foundThreat && doc.deviceRedirects?.enabled && doc.deviceRedirects.rules) {
                    const rule = doc.deviceRedirects.rules.find(r => threatMap.has(r.url));
                    if (rule) foundThreat = threatMap.get(rule.url);
                }
                if (!foundThreat && doc.timeRedirects?.enabled && doc.timeRedirects.rules) {
                    const rule = doc.timeRedirects.rules.find(r => threatMap.has(r.destination));
                    if (rule) foundThreat = threatMap.get(rule.destination);
                }

                if (foundThreat) {
                    const mapped = mapThreatToStatus(foundThreat);
                    status = mapped.status;
                    details = mapped.details;
                    threats++;

                    // Invalidate redirect cache immediately
                    invalidateCache(doc.shortId).catch(() => {});
                    if (doc.customAlias) invalidateCache(doc.customAlias).catch(() => {});
                }

                return {
                    updateOne: {
                        filter: { _id: doc._id },
                        update: {
                            safetyStatus: status,
                            safetyDetails: details,
                            lastCheckedAt: new Date(),
                        },
                    },
                };
            });

            if (bulkOps.length > 0) {
                await Url.bulkWrite(bulkOps, { ordered: false });
            }

            processed += urlsToCheck.length;
            await new Promise(r => setTimeout(r, 100)); // Respect CPU limits
        }

        logger.info(`[SafeBrowsing] Batch Scan Completed: Processed ${processed}, Threats Detected ${threats}`);
        return { processed, threats };
    } catch (error) {
        logger.error(`[SafeBrowsing] Batch Scan Error: ${error.message}`);
        return { processed, threats, error: error.message };
    }
};

/**
 * Sweeps 'pending' links that timed out during creation
 */
export const scanPendingLinks = async () => {
    return runBatchScan({
        safetyStatus: 'pending',
        manualSafetyOverride: { $ne: true },
    }, 200);
};

/**
 * Sweeps 'unchecked' or legacy null links
 */
export const scanUncheckedLinks = async () => {
    return runBatchScan({
        $and: [
            { manualSafetyOverride: { $ne: true } },
            {
                $or: [
                    { safetyStatus: { $in: ['unchecked', 'unknown'] } },
                    { safetyStatus: { $exists: false } },
                    { safetyStatus: null },
                ],
            },
        ],
    }, 500);
};

/**
 * Sweeps active links older than 30 days to catch newly compromised domains
 */
export const scanStaleLinks = async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return runBatchScan({
        isActive: true,
        manualSafetyOverride: { $ne: true },
        $or: [
            { lastCheckedAt: { $lt: thirtyDaysAgo } },
            { lastCheckedAt: { $exists: false } },
        ],
    }, 200);
};

export default {
    checkUrlsSafety,
    checkUrlSafety,
    scanPendingLinks,
    scanUncheckedLinks,
    scanStaleLinks,
    mapThreatToStatus,
};
