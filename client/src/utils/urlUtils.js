/**
 * Safely sanitizes a URL before using it in an href attribute.
 * Prevents javascript:, data:, and vbscript: XSS vectors.
 * If the URL is invalid, returns '#' or a safe fallback.
 */
export const sanitizeHref = (url) => {
    if (!url || typeof url !== 'string') return '#';
    try {
        const parsed = new URL(url, 'http://dummy.com');
        const protocol = parsed.protocol.toLowerCase();
        if (['javascript:', 'data:', 'vbscript:', 'file:'].includes(protocol)) {
            return '#';
        }
        return url;
    } catch {
        // If it's a relative URL or invalid, just return it or '#'
        // A regex to block malicious protocols at the start, including control characters
        // eslint-disable-next-line no-control-regex
        if (/^[\s\u0000-\u001F]*(javascript|data|vbscript|file):/i.test(url)) {
            return '#';
        }
        return url;
    }
};
