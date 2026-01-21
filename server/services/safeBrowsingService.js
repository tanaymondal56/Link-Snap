import axios from 'axios';
import Url from '../models/Url.js';
import Settings from '../models/Settings.js';

const SAFE_BROWSING_API_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

/**
 * Check a single URL against Google Safe Browsing API
 * @param {string} originalUrl - The URL to check
 * @returns {Promise<{status: string, details: string|null}>}
 */
/**
 * Core API Call to Google Safe Browsing
 * @param {Array<{url: string}>} threatEntries 
 * @returns {Promise<Map<string, string>>} Map of URL -> ThreatType
 */
const queryGoogleRef = async (threatEntries) => {
    if (!threatEntries.length) return new Map();
    
    // Deduplicate URLs to save quota
    const uniqueEntries = [...new Set(threatEntries.map(e => e.url))].map(url => ({ url }));

    const apiKey = process.env.GOOGLE_SAFE_BROWSING_KEY;
    const settings = await Settings.findOne();
    
    if (!apiKey || !settings?.safeBrowsingEnabled) return new Map();

    const requestBody = {
        client: { clientId: 'link-snap', clientVersion: '1.0.0' },
        threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: uniqueEntries
        }
    };

    const response = await axios.post(`${SAFE_BROWSING_API_URL}?key=${apiKey}`, requestBody);
    
    const matches = response.data.matches || [];
    const threatMap = new Map();
    matches.forEach(match => {
        threatMap.set(match.threat.url, match.threatType);
    });
    return threatMap;
};

/**
 * Check one or more URLs for safety
 * @param {string|string[]} urls - Single URL string or array of URL strings
 * @returns {Promise<{status: string, details: string|null}>} Aggregate status
 */
export const checkUrlsSafety = async (urls) => {
    try {
        const urlList = Array.isArray(urls) ? urls : [urls];
        // Filter out empty or non-string values
        const validUrls = urlList.filter(u => u && typeof u === 'string').map(u => ({ url: u }));
        
        if (validUrls.length === 0) return { status: 'safe', details: null };

        const threatMap = await queryGoogleRef(validUrls);

        if (threatMap.size > 0) {
            // Priority: Malware > Phishing > Unwanted
            const threatTypes = Array.from(threatMap.values());
            
            if (threatTypes.some(t => t === 'MALWARE' || t === 'POTENTIALLY_HARMFUL_APPLICATION')) {
                return { status: 'malware', details: 'Detected Malware/Harmful Content' };
            }
            if (threatTypes.some(t => t === 'SOCIAL_ENGINEERING')) {
                return { status: 'phishing', details: 'Detected Social Engineering' };
            }
            return { status: 'unwanted', details: 'Detected Unwanted Software' };
        }

        return { status: 'safe', details: null };
    } catch (error) {
        console.error('[SafeBrowsing] Check Failed:', error.message);
        return { status: 'pending', details: `Check Failed: ${error.message}` };
    }
};

/**
 * Legacy wrapper for single URL (backward compatibility)
 */
export const checkUrlSafety = (url) => checkUrlsSafety(url);

/**
 * Batch Scan Logic with Loop
 * Processes multiple batches to handle large datasets efficiently
 * @param {Object} query - Mongoose Filter Query
 * @param {number} maxLimit - Max items to process in this run
 */
const runBatchScan = async (query, maxLimit = 500) => {
    let processed = 0;
    let threats = 0;
    const BATCH_SIZE = 50; // Google API limit is often 500, but 50 is safer for timeout
    
    try {
        const settings = await Settings.findOne();
        if (!settings?.safeBrowsingEnabled) return { processed: 0, message: 'Feature disabled' };
        
        // Loop until maxLimit reached or no more links
        while (processed < maxLimit) {
            const batchLimit = Math.min(BATCH_SIZE, maxLimit - processed);
            
            // Get batch of URLs
            const urlsToCheck = await Url.find(query)
                .limit(batchLimit)
                .select('originalUrl deviceRedirects timeRedirects _id'); // Select sub-fields too!

            if (urlsToCheck.length === 0) break;

            // Collect ALL URLs from these docs (Original + Redirects)
            const allThreatEntries = [];
            // docMap removed (unused)

            urlsToCheck.forEach(doc => {
                 // 1. Original
                 if (doc.originalUrl) allThreatEntries.push({ url: doc.originalUrl });
                 
                 // 2. Device Redirects
                 if (doc.deviceRedirects?.enabled && doc.deviceRedirects.rules) {
                     doc.deviceRedirects.rules.forEach(r => {
                         if (r.url) allThreatEntries.push({ url: r.url });
                     });
                 }

                 // 3. Time Redirects
                 if (doc.timeRedirects?.enabled && doc.timeRedirects.rules) {
                     doc.timeRedirects.rules.forEach(r => {
                         if (r.destination) allThreatEntries.push({ url: r.destination });
                     });
                 }
            });

            // Call API
            const threatMap = await queryGoogleRef(allThreatEntries);
            
            // Update Docs based on findings (Bulk Write Optimization)
            const bulkOps = urlsToCheck.map((doc) => {
                let status = 'safe';
                let details = null;
                let foundThreat = null;

                // Check Original
                if (threatMap.has(doc.originalUrl)) foundThreat = threatMap.get(doc.originalUrl);
                
                // Check Device Rules
                if (!foundThreat && doc.deviceRedirects?.enabled && doc.deviceRedirects?.rules) {
                    const rule = doc.deviceRedirects.rules.find(r => threatMap.has(r.url));
                    if (rule) foundThreat = threatMap.get(rule.url);
                }

                // Check Time Rules
                if (!foundThreat && doc.timeRedirects?.enabled && doc.timeRedirects?.rules) {
                    const rule = doc.timeRedirects.rules.find(r => threatMap.has(r.destination));
                    if (rule) foundThreat = threatMap.get(rule.destination);
                }

                if (foundThreat) {
                    if (foundThreat === 'SOCIAL_ENGINEERING') status = 'phishing';
                    else if (foundThreat === 'UNWANTED_SOFTWARE') status = 'unwanted';
                    else status = 'malware';
                    details = foundThreat;
                    threats++;
                }

                return {
                    updateOne: {
                        filter: { _id: doc._id },
                        update: {
                            safetyStatus: status,
                            safetyDetails: details,
                            lastCheckedAt: new Date()
                        }
                    }
                };
            });

            if (bulkOps.length > 0) {
                await Url.bulkWrite(bulkOps, { ordered: false });
            }
            processed += urlsToCheck.length;

            // Small delay to be nice to CPU and Rate Limits
            await new Promise(r => setTimeout(r, 200)); 
        }

        console.log(`[SafeBrowsing] Batch Scan Final: Processed ${processed}, Threats ${threats}`);
        return { processed, threats };

    } catch (error) {
        console.error('[SafeBrowsing] Batch Scan Failed:', error.message);
        return { processed, error: error.message };
    }
};

/**
 * Retries any 'pending' links (excludes manually overridden)
 */
export const scanPendingLinks = async () => {
    // Retry up to 200 pending links per cron run
    // Exclude manually overridden links - admin decisions are final
    return runBatchScan({ 
        safetyStatus: 'pending',
        manualSafetyOverride: { $ne: true }
    }, 200);
};

/**
 * Scans 'unchecked' links (Retroactive, excludes manually overridden)
 */
export const scanUncheckedLinks = async () => {
    // Process up to 500 links per manual trigger
    // Includes: explicit 'unchecked', 'unknown', or missing/null field
    // Exclude manually overridden links - admin decisions are final
    return runBatchScan({ 
        $and: [
            { manualSafetyOverride: { $ne: true } },
            { $or: [
                { safetyStatus: { $in: ['unchecked', 'unknown'] } },
                { safetyStatus: { $exists: false } },
                { safetyStatus: null }
            ]}
        ]
    }, 500);
};
