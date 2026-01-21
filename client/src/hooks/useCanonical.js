import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook to dynamically update the canonical URL based on current route
 * This helps with SEO by telling search engines the preferred URL for a page
 */
export const useCanonical = () => {
    const location = useLocation();

    useEffect(() => {
        const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
        const canonicalUrl = `${baseUrl}${location.pathname}${location.search}`;

        // Find existing canonical link or create new one
        let canonical = document.querySelector('link[rel="canonical"]');

        if (!canonical) {
            canonical = document.createElement('link');
            canonical.setAttribute('rel', 'canonical');
            document.head.appendChild(canonical);
        }

        canonical.setAttribute('href', canonicalUrl);
    }, [location.pathname, location.search]);
};
