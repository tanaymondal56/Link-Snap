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
