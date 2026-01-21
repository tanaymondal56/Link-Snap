// Centralized configuration for URLs and domains
// Uses environment variables with fallbacks

const config = {
    // Get base URL from environment or fallback
    getBaseUrl: () => {
        const baseUrl = import.meta.env.VITE_BASE_URL;
        const isProduction = import.meta.env.PROD;

        // In production, use env var or current origin
        if (isProduction) {
            return baseUrl || window.location.origin;
        }

        // In development
        return baseUrl || 'http://localhost:5173';
    },

    // Get domain without protocol
    getDomain: () => {
        const domain = import.meta.env.VITE_DOMAIN;
        const isProduction = import.meta.env.PROD;

        if (isProduction) {
            return domain || window.location.host;
        }

        return domain || 'localhost:5173';
    },

    // Get full URL with protocol
    getFullUrl: (path = '') => {
        const baseUrl = config.getBaseUrl();
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${baseUrl}${cleanPath}`;
    },

    // Check if running in production
    isProduction: () => import.meta.env.PROD,

    // Check if running in development
    isDevelopment: () => import.meta.env.DEV,
};

export default config;
