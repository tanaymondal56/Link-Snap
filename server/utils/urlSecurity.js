/**
 * URL Security Validator
 * Prevents SSRF attacks by blocking internal/private network URLs
 */

// Private IPv4 ranges (RFC 1918 + loopback + link-local)
const PRIVATE_IPV4_RANGES = [
    /^127\./,                          // Loopback (127.0.0.0/8)
    /^10\./,                           // Private Class A (10.0.0.0/8)
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // Private Class B (172.16.0.0/12)
    /^192\.168\./,                     // Private Class C (192.168.0.0/16)
    /^169\.254\./,                     // Link-local (169.254.0.0/16)
    /^0\./,                            // Current network (0.0.0.0/8)
];

// Blocked hostnames
const BLOCKED_HOSTNAMES = [
    'localhost',
    'localhost.localdomain',
    '0.0.0.0',
    '[::]',
    '[::1]',
];

// Cloud metadata endpoints (AWS, GCP, Azure, etc.)
const CLOUD_METADATA_HOSTS = [
    '169.254.169.254',     // AWS/GCP/Azure metadata
    'metadata.google.internal',
    'metadata.gcp.internal',
];

/**
 * Check if a hostname is an IPv4 address
 */
const isIPv4 = (hostname) => {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
};

/**
 * Check if a hostname is an IPv6 address
 */
const isIPv6 = (hostname) => {
    // Simplified check - brackets around IPv6 in URLs or contains colons
    return hostname.startsWith('[') || (hostname.includes(':') && !hostname.includes('.'));
};

/**
 * Check if IPv4 is in private range
 */
const isPrivateIPv4 = (ip) => {
    return PRIVATE_IPV4_RANGES.some(regex => regex.test(ip));
};

/**
 * Validate URL is safe for server-side requests (prevents SSRF)
 * @param {string} url - URL to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateUrlSecurity = (url) => {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        const protocol = parsed.protocol.toLowerCase();

        // 1. Only allow HTTP/HTTPS
        if (protocol !== 'http:' && protocol !== 'https:') {
            return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
        }

        // 2. Block localhost and common internal hostnames
        if (BLOCKED_HOSTNAMES.includes(hostname)) {
            return { valid: false, error: 'Internal/localhost URLs are not allowed' };
        }

        // 3. Block cloud metadata endpoints
        if (CLOUD_METADATA_HOSTS.includes(hostname)) {
            return { valid: false, error: 'Cloud metadata URLs are not allowed' };
        }

        // 4. Check for IP addresses
        if (isIPv4(hostname)) {
            if (isPrivateIPv4(hostname)) {
                return { valid: false, error: 'Private/internal IP addresses are not allowed' };
            }
        }

        // 5. Block IPv6 (often used for SSRF bypass)
        if (isIPv6(hostname)) {
            return { valid: false, error: 'IPv6 addresses are not allowed' };
        }

        // 6. Block URLs with user info (potential bypass technique)
        if (parsed.username || parsed.password) {
            return { valid: false, error: 'URLs with credentials are not allowed' };
        }

        // 7. Block non-standard ports for common internal services
        const port = parsed.port;
        const blockedPorts = ['22', '23', '25', '3306', '5432', '6379', '27017', '11211'];
        if (port && blockedPorts.includes(port)) {
            return { valid: false, error: 'URLs targeting internal service ports are not allowed' };
        }

        // 8. Block suspicious patterns (DNS rebinding attempts)
        if (hostname.endsWith('.internal') || hostname.endsWith('.local') || hostname.endsWith('.corp')) {
            return { valid: false, error: 'Internal domain names are not allowed' };
        }

        return { valid: true };
    } catch {
        return { valid: false, error: 'Invalid URL format' };
    }
};

/**
 * Sanitize alias to prevent NoSQL injection
 * Only allows alphanumeric, hyphens, and underscores
 * @param {string} alias - Alias to sanitize
 * @returns {{ valid: boolean, sanitized?: string, error?: string }}
 */
export const sanitizeAlias = (alias) => {
    if (typeof alias !== 'string') {
        return { valid: false, error: 'Alias must be a string' };
    }

    // Check for MongoDB operators
    if (alias.startsWith('$') || alias.includes('$')) {
        return { valid: false, error: 'Invalid characters in alias' };
    }

    // Only allow alphanumeric, hyphens, underscores
    const sanitized = alias.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
        return { valid: false, error: 'Alias can only contain letters, numbers, hyphens, and underscores' };
    }

    // Length check
    if (sanitized.length < 1 || sanitized.length > 50) {
        return { valid: false, error: 'Alias must be between 1 and 50 characters' };
    }

    return { valid: true, sanitized };
};
