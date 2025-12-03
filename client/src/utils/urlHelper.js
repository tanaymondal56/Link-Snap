export const getShortUrl = (shortId) => {
    // Prefer a dedicated env var for the short URL domain
    const serverUrl = import.meta.env.VITE_SERVER_URL;

    if (serverUrl) {
        // Remove trailing slash if present
        const cleanUrl = serverUrl.replace(/\/$/, '');
        return `${cleanUrl}/${shortId}`;
    }

    // Fallback: Try to derive from API URL
    const apiUrl = import.meta.env.VITE_API_URL;
    if (apiUrl) {
        // If API is http://site.com/api, we want http://site.com
        return `${apiUrl.replace('/api', '')}/${shortId}`;
    }

    // Last resort fallback (Development default)
    return `http://localhost:5000/${shortId}`;
};
