/**
 * Offline Cache Service
 * Provides caching for link data to enable offline viewing
 */

const CACHE_KEY = 'linksnap_links_cache';
const CACHE_TIMESTAMP_KEY = 'linksnap_links_cache_timestamp';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Save links to local storage for offline access
 * @param {Array} links - Array of link objects
 */
export const cacheLinks = (links) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(links));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.warn('Failed to cache links:', error);
  }
};

/**
 * Get cached links from local storage
 * @returns {Array|null} Cached links or null if not found/expired
 */
export const getCachedLinks = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

    if (!cached || !timestamp) return null;

    // Check if cache is expired (optional - can still use stale data offline)
    const age = Date.now() - parseInt(timestamp);
    const isExpired = age > CACHE_EXPIRY_MS;

    return {
      links: JSON.parse(cached),
      isExpired,
      age,
      timestamp: new Date(parseInt(timestamp)),
    };
  } catch (error) {
    console.warn('Failed to get cached links:', error);
    return null;
  }
};

/**
 * Clear the links cache
 */
export const clearLinksCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  } catch (error) {
    console.warn('Failed to clear links cache:', error);
  }
};

/**
 * Check if there's cached data available
 * @returns {boolean}
 */
export const hasCachedLinks = () => {
  return localStorage.getItem(CACHE_KEY) !== null;
};

/**
 * Get cache age in human-readable format
 * @returns {string|null}
 */
export const getCacheAge = () => {
  const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
  if (!timestamp) return null;

  const age = Date.now() - parseInt(timestamp);
  const minutes = Math.floor(age / (1000 * 60));
  const hours = Math.floor(age / (1000 * 60 * 60));
  const days = Math.floor(age / (1000 * 60 * 60 * 24));

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
};

export default {
  cacheLinks,
  getCachedLinks,
  clearLinksCache,
  hasCachedLinks,
  getCacheAge,
};
