/**
 * Get the full short URL for a given shortId
 * Used for: copying to clipboard, href links, QR codes
 */
export const getShortUrl = (shortId) => {
    const serverUrl = import.meta.env.VITE_SERVER_URL;
    const isProduction = import.meta.env.PROD;

    // In production: check if VITE_SERVER_URL is localhost
    // If it is, use window.location.origin instead (for Cloudflare/deployed URLs)
    if (isProduction) {
        // If serverUrl is set and NOT localhost, use it
        if (serverUrl && !serverUrl.includes('localhost') && !serverUrl.includes('127.0.0.1')) {
            const cleanUrl = serverUrl.replace(/\/$/, '');
            return `${cleanUrl}/${shortId}`;
        }
        // Otherwise use current browser origin (works with Cloudflare, etc.)
        return `${window.location.origin}/${shortId}`;
    }

    // In development: use env vars or fallback to localhost:5000
    if (serverUrl) {
        const cleanUrl = serverUrl.replace(/\/$/, '');
        return `${cleanUrl}/${shortId}`;
    }

    // Fallback: Try to derive from API URL
    const apiUrl = import.meta.env.VITE_API_URL;
    if (apiUrl && !apiUrl.startsWith('/')) {
        return `${apiUrl.replace('/api', '')}/${shortId}`;
    }

    // Last resort fallback (Development default)
    return `http://localhost:5000/${shortId}`;
};

/**
 * Get the domain portion only (without protocol)
 * Used for display purposes where space is limited
 */
export const getDomain = () => {
    const fullUrl = getShortUrl('');
    return fullUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
};

/**
 * Get a display-friendly truncated version of the short URL
 * For long domains (like Azure), shows: domain.../shortId
 * 
 * @param {string} shortId - The short ID or custom alias
 * @param {object} options - Configuration options
 * @param {number} options.maxDomainLength - Max chars to show from domain (default: 15)
 * @param {boolean} options.showProtocol - Whether to show https:// (default: false)
 * @returns {string} Display-friendly short URL
 */
export const getDisplayShortUrl = (shortId, options = {}) => {
    const { maxDomainLength = 15, showProtocol = false } = options;

    const fullUrl = getShortUrl(shortId);
    const domain = fullUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    // If domain is short enough, show it all
    if (domain.length <= maxDomainLength) {
        return showProtocol ? fullUrl : `${domain}/${shortId}`;
    }

    // For long domains, truncate intelligently
    // Show first part + ellipsis + /<shortId>
    const truncatedDomain = domain.slice(0, maxDomainLength - 3) + '...';
    return `${truncatedDomain}/${shortId}`;
};

/**
 * Get just the path portion for compact display
 * Shows: /<shortId> or /<customAlias>
 */
export const getShortPath = (shortId) => {
    return `/${shortId}`;
};
