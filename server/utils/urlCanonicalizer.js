/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GOOGLE SAFE BROWSING v5 URL CANONICALIZATION & EXPRESSION ENGINE
 * ═══════════════════════════════════════════════════════════════════════════════
 * Implements the official Google Safe Browsing canonicalization and prefix hashing
 * specifications (URLs.and.Hashing.md):
 * 1. Sanitization: Strip tab, CR, LF, and URL fragments.
 * 2. Repeated percent-unescaping until stable.
 * 3. Hostname normalization: Punycode, IPv4 octal/hex normalization, IPv6 collapsing,
 *    IPv4-mapped / NAT64 IPv6 conversion to IPv4, and lowercase conversion.
 * 4. Path normalization: Resolution of /./ and /../, slash deduplication.
 * 5. Host-Suffix / Path-Prefix Expression Generation (up to 30 expressions).
 * 6. SHA-256 Hash Computation and 4-Byte Prefix Extraction.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import crypto from 'node:crypto';
import ipaddr from 'ipaddr.js';

/**
 * Normalizes an IPv4 address from any valid format (decimal, octal, hex, fewer components)
 * to standard 4 dot-separated decimal components.
 * 
 * @param {string} host - Candidate host string
 * @returns {string|null} Canonical IPv4 string or null if not IPv4
 */
const normalizeIPv4 = (host) => {
    if (!host || typeof host !== 'string') return null;
    const cleanHost = host.trim();

    // Check if parts are numeric/hex/octal
    const parts = cleanHost.split('.');
    if (parts.length > 4 || parts.length === 0) return null;

    const nums = [];
    for (const part of parts) {
        if (!part) return null;
        let num;
        if (/^0x[0-9a-f]+$/i.test(part)) {
            num = parseInt(part, 16);
        } else if (/^0[0-7]+$/.test(part)) {
            num = parseInt(part, 8);
        } else if (/^\d+$/.test(part)) {
            num = parseInt(part, 10);
        } else {
            return null;
        }
        if (isNaN(num) || num < 0) return null;
        nums.push(num);
    }

    // Convert multi-part or single-part integer into standard 4-octet IPv4
    let val;
    if (nums.length === 1) {
        val = nums[0];
    } else if (nums.length === 2) {
        if (nums[0] > 255 || nums[1] > 0xffffff) return null;
        val = (nums[0] << 24) + nums[1];
    } else if (nums.length === 3) {
        if (nums[0] > 255 || nums[1] > 255 || nums[2] > 0xffff) return null;
        val = (nums[0] << 24) + (nums[1] << 16) + nums[2];
    } else if (nums.length === 4) {
        if (nums.some(n => n > 255)) return null;
        return nums.join('.');
    } else {
        return null;
    }

    val = val >>> 0; // Unsigned 32-bit
    const b1 = (val >>> 24) & 0xff;
    const b2 = (val >>> 16) & 0xff;
    const b3 = (val >>> 8) & 0xff;
    const b4 = val & 0xff;
    return `${b1}.${b2}.${b3}.${b4}`;
};

/**
 * Normalizes an IPv6 address according to RFC 5952 and transforms IPv4-mapped or NAT64 addresses to IPv4.
 * 
 * @param {string} host - Hostname potentially wrapped in brackets
 * @returns {string|null} Normalized IPv6 (bracketed) or IPv4 string, or null if not IPv6
 */
const normalizeIPv6 = (host) => {
    let clean = host.trim();
    if (clean.startsWith('[') && clean.endsWith(']')) {
        clean = clean.slice(1, -1);
    }

    try {
        if (!ipaddr.IPv6.isValid(clean)) return null;
        const addr = ipaddr.IPv6.parse(clean);

        // IPv4-mapped IPv6 address (::ffff:1.2.3.4)
        if (addr.isIPv4MappedAddress()) {
            return addr.toIPv4Address().toString();
        }

        // NAT64 prefix (64:ff9b::/96)
        const parts = addr.parts;
        if (parts[0] === 0x0064 && parts[1] === 0xff9b && parts[2] === 0 && parts[3] === 0 && parts[4] === 0 && parts[5] === 0) {
            const b1 = (parts[6] >>> 8) & 0xff;
            const b2 = parts[6] & 0xff;
            const b3 = (parts[7] >>> 8) & 0xff;
            const b4 = parts[7] & 0xff;
            return `${b1}.${b2}.${b3}.${b4}`;
        }

        return `[${addr.toNormalizedString()}]`;
    } catch {
        return null;
    }
};

/**
 * Repeatedly percent-unescapes a string until it is stable (no more percent-escapes).
 * 
 * @param {string} str - String to unescape
 * @returns {string} Fully percent-unescaped string
 */
export const fullyPercentUnescape = (str) => {
    let current = str;
    let prev = '';
    let iterations = 0;
    while (current !== prev && iterations < 10) {
        prev = current;
        try {
            current = decodeURIComponent(current);
        } catch {
            // Handle incomplete percent-encodings by replacing valid %XX tokens
            current = current.replace(/%([0-9a-fA-F]{2})/g, (_, hex) => {
                try {
                    return String.fromCharCode(parseInt(hex, 16));
                } catch {
                    return `%${hex}`;
                }
            });
        }
        iterations++;
    }
    return current;
};

/**
 * Percent-escapes characters <= 32, >= 127, '#', or '%' in a URL string.
 * 
 * @param {string} str - Raw canonical string
 * @returns {string} Escaped string
 */
const escapeSpecialChars = (str) => {
    let result = '';
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        const char = str[i];
        if (code <= 32 || code >= 127 || char === '#' || char === '%') {
            result += `%${code.toString(16).toUpperCase().padStart(2, '0')}`;
        } else {
            result += char;
        }
    }
    return result;
};

/**
 * Canonicalizes a hostname according to Google Safe Browsing rules:
 * - Leading/trailing dots stripped
 * - Consecutive dots collapsed
 * - IPv4 normalization
 * - IPv6 normalization (mapped IPv6 to IPv4)
 * - Lowercased
 * 
 * @param {string} rawHost - Raw hostname string
 * @returns {string} Canonical hostname
 */
export const canonicalizeHost = (rawHost) => {
    let host = rawHost.replace(/^\.+|\.+$/g, '').replace(/\.+/g, '.').toLowerCase();

    // Check IPv6
    const ipv6 = normalizeIPv6(host);
    if (ipv6) return ipv6;

    // Check IPv4
    const ipv4 = normalizeIPv4(host);
    if (ipv4) return ipv4;

    // Handle Punycode conversion if needed
    try {
        const url = new URL(`http://${host}`);
        host = url.hostname;
    } catch {
        // Keep sanitized host
    }

    return host;
};

/**
 * Canonicalizes a URL path according to Google Safe Browsing rules:
 * - Resolves /./ and /../
 * - Collapses consecutive slashes
 * 
 * @param {string} rawPath - Raw path string
 * @returns {string} Canonical path
 */
export const canonicalizePath = (rawPath) => {
    let path = rawPath || '/';
    if (!path.startsWith('/')) path = `/${path}`;

    // Resolve /./ and /../
    const segments = path.split('/');
    const resolved = [];

    for (const seg of segments) {
        if (seg === '.' || seg === '') {
            // Skip empty or dot
            continue;
        } else if (seg === '..') {
            if (resolved.length > 0) {
                resolved.pop();
            }
        } else {
            resolved.push(seg);
        }
    }

    let result = `/${resolved.join('/')}`;
    if (path.endsWith('/') && !result.endsWith('/')) {
        result += '/';
    }
    if (result === '') result = '/';
    return result;
};

/**
 * Canonicalizes a complete URL according to Google Safe Browsing v5 specifications.
 * 
 * @param {string} rawUrl - The raw input URL
 * @returns {{ canonicalUrl: string, host: string, path: string, query: string }} Canonical components
 */
export const canonicalizeUrl = (rawUrl) => {
    if (!rawUrl || typeof rawUrl !== 'string') {
        throw new Error('Invalid URL string provided for canonicalization');
    }

    // 1. Remove tabs, CR, and LF characters
    let urlStr = rawUrl.replace(/[\t\r\n]/g, '').trim();

    // 2. Ensure scheme
    if (!/^https?:\/\//i.test(urlStr)) {
        urlStr = `http://${urlStr}`;
    }

    // 3. Remove fragment
    const hashIndex = urlStr.indexOf('#');
    if (hashIndex !== -1) {
        urlStr = urlStr.slice(0, hashIndex);
    }

    // 4. Repeatedly percent-unescape
    urlStr = fullyPercentUnescape(urlStr);

    // Split into scheme and remainder
    const schemeMatch = urlStr.match(/^[a-z0-9+-.]+:\/\/(.*)$/i);
    const afterScheme = schemeMatch ? schemeMatch[1] : urlStr;

    // Split authority from path + query
    let hostPart = afterScheme;
    let pathPart = '/';
    let queryPart = '';

    const firstSlash = afterScheme.indexOf('/');
    const firstQuestion = afterScheme.indexOf('?');

    let splitIndex = -1;
    if (firstSlash !== -1 && firstQuestion !== -1) {
        splitIndex = Math.min(firstSlash, firstQuestion);
    } else if (firstSlash !== -1) {
        splitIndex = firstSlash;
    } else if (firstQuestion !== -1) {
        splitIndex = firstQuestion;
    }

    if (splitIndex !== -1) {
        hostPart = afterScheme.slice(0, splitIndex);
        const remainder = afterScheme.slice(splitIndex);
        const qIndex = remainder.indexOf('?');
        if (qIndex !== -1) {
            pathPart = remainder.slice(0, qIndex);
            queryPart = remainder.slice(qIndex); // includes '?'
        } else {
            pathPart = remainder;
        }
    }

    // Strip port or credentials from hostPart if present
    if (hostPart.includes('@')) {
        hostPart = hostPart.split('@').pop();
    }
    // Remove port if present (handle IPv6 [::1]:port properly)
    if (hostPart.startsWith('[')) {
        const endBracket = hostPart.indexOf(']');
        if (endBracket !== -1) {
            hostPart = hostPart.slice(0, endBracket + 1);
        }
    } else if (hostPart.includes(':')) {
        hostPart = hostPart.split(':')[0];
    }

    const canonHost = canonicalizeHost(hostPart);
    const canonPath = canonicalizePath(pathPart);

    // Percent-escape invalid characters in path and query
    const escapedPath = escapeSpecialChars(canonPath);
    const escapedQuery = queryPart ? escapeSpecialChars(queryPart) : '';

    const canonicalUrl = `${canonHost}${escapedPath}${escapedQuery}`;

    return {
        canonicalUrl,
        host: canonHost,
        path: escapedPath,
        query: escapedQuery,
    };
};

/**
 * Generates host-suffix and path-prefix expressions for a URL.
 * Produces up to 30 expressions matching Google's lookup algorithm.
 * 
 * @param {string} rawUrl - Raw input URL
 * @returns {string[]} Array of candidate host/path expressions
 */
export const generateExpressions = (rawUrl) => {
    const { host, path, query } = canonicalizeUrl(rawUrl);

    // 1. Host suffixes
    const hostCandidates = [];
    const isIP = normalizeIPv4(host) !== null || (host.startsWith('[') && host.endsWith(']'));

    if (isIP) {
        hostCandidates.push(host);
    } else {
        const parts = host.split('.');
        // Up to 5 host suffixes ending in the TLD
        // For a.b.c.d.e.com:
        // a.b.c.d.e.com, b.c.d.e.com, c.d.e.com, d.e.com, e.com
        const maxParts = Math.min(parts.length, 5);
        for (let i = parts.length - maxParts; i < parts.length - 1; i++) {
            hostCandidates.push(parts.slice(i).join('.'));
        }
        if (!hostCandidates.includes(host)) {
            hostCandidates.unshift(host);
        }
        // Deduplicate and cap at 5
        while (hostCandidates.length > 5) {
            hostCandidates.pop();
        }
    }

    // 2. Path prefixes
    const pathCandidates = [];
    // Full path with query
    if (query) {
        pathCandidates.push(`${path}${query}`);
    }
    // Full path without query
    pathCandidates.push(path);

    // Successive prefixes ending in '/'
    const pathSegments = path.split('/').filter(Boolean);
    const maxPrefixes = Math.min(pathSegments.length, 4);
    for (let i = 1; i <= maxPrefixes; i++) {
        const subPath = `/${pathSegments.slice(0, i).join('/')}/`;
        if (!pathCandidates.includes(subPath)) {
            pathCandidates.push(subPath);
        }
    }
    if (!pathCandidates.includes('/')) {
        pathCandidates.push('/');
    }

    // Deduplicate and cap at 6
    const uniquePaths = Array.from(new Set(pathCandidates)).slice(0, 6);

    // 3. Combine hosts and paths (up to 30 combinations)
    const expressions = [];
    for (const h of hostCandidates) {
        for (const p of uniquePaths) {
            expressions.push(`${h}${p}`);
        }
    }

    return Array.from(new Set(expressions));
};

/**
 * Computes SHA-256 hashes and extracts 4-byte prefixes for all URL expressions.
 * 
 * @param {string} url - Target URL
 * @returns {{
 *   expressions: string[],
 *   fullHashes: Map<string, Buffer>,
 *   prefixes: string[],
 *   prefixToFullHashMap: Map<string, Buffer[]>
 * }} Hash prefix lookup structures
 */
export const getUrlHashPrefixes = (url) => {
    const expressions = generateExpressions(url);
    const fullHashes = new Map(); // expression -> 32-byte Buffer
    const prefixToFullHashMap = new Map(); // 4-byte base64 prefix -> Buffer[]

    for (const expr of expressions) {
        const hash = crypto.createHash('sha256').update(expr).digest();
        fullHashes.set(expr, hash);

        const prefixBuffer = hash.subarray(0, 4);
        const prefixBase64 = prefixBuffer.toString('base64url');

        if (!prefixToFullHashMap.has(prefixBase64)) {
            prefixToFullHashMap.set(prefixBase64, []);
        }
        prefixToFullHashMap.get(prefixBase64).push(hash);
    }

    return {
        expressions,
        fullHashes,
        prefixes: Array.from(prefixToFullHashMap.keys()),
        prefixToFullHashMap,
    };
};

export default {
    canonicalizeUrl,
    canonicalizeHost,
    canonicalizePath,
    generateExpressions,
    getUrlHashPrefixes,
    fullyPercentUnescape,
};
