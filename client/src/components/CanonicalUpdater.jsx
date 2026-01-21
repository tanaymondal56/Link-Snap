import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Component that updates the canonical URL meta tag based on the current route
 * This helps with SEO by telling search engines the canonical (preferred) URL for each page
 */
export default function CanonicalUpdater() {
  const location = useLocation();

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
    const canonicalUrl = `${baseUrl}${location.pathname}`;

    // Find or create canonical link element
    let canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute('href', canonicalUrl);
    }
  }, [location.pathname]);

  // This component doesn't render anything
  return null;
}
