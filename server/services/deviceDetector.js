/**
 * Device Detection Service
 * Detects device type from User-Agent for conditional redirects
 * 
 * @module services/deviceDetector
 */

import { UAParser } from 'ua-parser-js';

/**
 * Detects device type from User-Agent header
 * @param {string} userAgent - The User-Agent string from request headers
 * @returns {Object} { type, os, browser }
 */
export const detectDevice = (userAgent) => {
    if (!userAgent) {
        return { type: 'desktop', os: null, browser: null };
    }

    const parser = new UAParser(userAgent);
    const device = parser.getDevice();
    const os = parser.getOS();
    const browser = parser.getBrowser();

    // Normalize OS name for consistent matching
    const osName = os.name?.toLowerCase() || null;
    let normalizedOs = null;

    if (osName) {
        if (osName.includes('ios') || osName === 'mac os') {
            // Check if it's actually iOS (mobile) vs macOS (desktop)
            if (device.type === 'mobile' || device.type === 'tablet') {
                normalizedOs = 'ios';
            } else {
                normalizedOs = 'macos';
            }
        } else if (osName.includes('android')) {
            normalizedOs = 'android';
        } else if (osName.includes('windows')) {
            normalizedOs = 'windows';
        } else if (osName.includes('linux')) {
            normalizedOs = 'linux';
        } else {
            normalizedOs = osName;
        }
    }

    return {
        type: device.type || 'desktop', // 'mobile', 'tablet', 'desktop', or undefined
        os: normalizedOs,
        browser: browser.name || null
    };
};

/**
 * Matches device against redirect rules
 * Returns matched URL and the rule that matched (for analytics)
 * 
 * Priority order:
 * 1. Specific OS rules (ios, android) - checked first if priority is higher
 * 2. Device type rules (mobile, tablet, desktop)
 * 3. Tablet fallback to mobile if no tablet rule exists
 * 
 * @param {Object} deviceInfo - Result from detectDevice()
 * @param {Array} rules - Array of device redirect rules
 * @returns {Object|null} { url, matched } or null if no match
 */
export const matchDeviceRule = (deviceInfo, rules) => {
    if (!rules?.length) return null;

    // Sort by priority (higher first)
    const sortedRules = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // PRIORITY FIX: Check OS-specific rules (iOS/Android) first, regardless of priority
    // This ensures iOS users go to App Store even if Mobile rule has higher priority
    const osSpecificRules = sortedRules.filter(r => ['ios', 'android'].includes(r.device));
    const deviceTypeRules = sortedRules.filter(r => !['ios', 'android'].includes(r.device));

    // TABLET PRIORITY: If device is a tablet, check for Tablet rule FIRST
    // This allows iPads to use the "Tablet" rule instead of the "iOS" rule if a Tablet rule is explicitly set
    if (deviceInfo.type === 'tablet') {
        const tabletRule = deviceTypeRules.find(r => r.device === 'tablet');
        if (tabletRule) {
             return { url: tabletRule.url, matched: 'tablet' };
        }
    }

    // First pass: Check OS-specific rules
    for (const rule of osSpecificRules) {
        if (rule.device === 'ios' && deviceInfo.os === 'ios') {
            return { url: rule.url, matched: 'ios' };
        }
        if (rule.device === 'android' && deviceInfo.os === 'android') {
            return { url: rule.url, matched: 'android' };
        }
    }

    // Second pass: Check device type rules
    for (const rule of deviceTypeRules) {
        switch (rule.device) {
            case 'mobile':
                if (deviceInfo.type === 'mobile') {
                    return { url: rule.url, matched: 'mobile' };
                }
                break;
            case 'tablet':
                if (deviceInfo.type === 'tablet') {
                    return { url: rule.url, matched: 'tablet' };
                }
                break;
            case 'desktop':
                if (deviceInfo.type === 'desktop' || !deviceInfo.type) {
                    return { url: rule.url, matched: 'desktop' };
                }
                break;
        }
    }

    // TABLET FALLBACK: If tablet device and no tablet rule, try mobile rule
    if (deviceInfo.type === 'tablet') {
        const mobileRule = sortedRules.find(r => r.device === 'mobile');
        if (mobileRule) {
            return { url: mobileRule.url, matched: 'mobile_fallback' };
        }
    }

    return null;
};

/**
 * Gets the final redirect URL based on device rules
 * @param {Object} urlDoc - The URL document from database
 * @param {string} userAgent - User-Agent header
 * @returns {Object} { targetUrl, deviceMatchType }
 */
export const getDeviceRedirectUrl = (urlDoc, userAgent) => {
    let targetUrl = urlDoc.originalUrl;
    let deviceMatchType = null;

    if (urlDoc.deviceRedirects?.enabled && urlDoc.deviceRedirects?.rules?.length) {
        const deviceInfo = detectDevice(userAgent);
        const matchResult = matchDeviceRule(deviceInfo, urlDoc.deviceRedirects.rules);

        if (matchResult) {
            targetUrl = matchResult.url;
            deviceMatchType = matchResult.matched;
        }
    }

    return { targetUrl, deviceMatchType };
};
