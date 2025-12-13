// App version configuration
// This module provides dynamic version fetching from the API with robust fallback handling

// Fallback version used when API is unavailable or on first load
export const FALLBACK_VERSION = '0.5.5';

// Cache configuration
const CACHE_KEY = 'app_version_cache_v2';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache TTL
const FETCH_TIMEOUT_MS = 5000; // 5 second timeout for API calls

// Dynamically determine API URL (matches axios config logic)
const getVersionApiUrl = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    const isProduction = import.meta.env.PROD;

    // In production: use relative path or configured URL
    if (isProduction) {
        if (apiUrl && !apiUrl.includes('localhost') && !apiUrl.includes('127.0.0.1') && !apiUrl.startsWith('/')) {
            return `${apiUrl}/changelog/version`;
        }
        return '/api/changelog/version';
    }

    // In development: use env var or fallback
    if (apiUrl) {
        return `${apiUrl}/changelog/version`;
    }
    return 'http://localhost:5000/api/changelog/version';
};

/**
 * Get cached version data from localStorage
 * @returns {Object|null} Cached data with version and timestamp, or null if invalid/expired
 */
const getCachedVersion = () => {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;
        
        const data = JSON.parse(cached);
        
        // Validate cache structure
        if (!data.version || !data.cachedAt) return null;
        
        // Check if cache is expired
        const cacheAge = Date.now() - data.cachedAt;
        if (cacheAge > CACHE_TTL_MS) {
            // Cache expired but return stale data (can be used as fallback)
            return { ...data, isStale: true };
        }
        
        return { ...data, isStale: false };
    } catch (error) {
        // Cache corrupted, clear it
        console.warn('Version cache read error:', error.message);
        localStorage.removeItem(CACHE_KEY);
        return null;
    }
};

/**
 * Save version to localStorage cache
 * @param {string} version - Version string to cache
 */
const setCachedVersion = (version) => {
    try {
        const data = {
            version,
            cachedAt: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (error) {
        // localStorage might be full or disabled - fail silently
        console.warn('Version cache write error:', error.message);
    }
};

/**
 * Fetch the latest version from the API with timeout
 * @returns {Promise<string|null>} Version string or null if fetch fails
 */
const fetchVersionFromAPI = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    
    try {
        const response = await fetch(getVersionApiUrl(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            console.warn('Version API returned status:', response.status);
            return null;
        }
        
        const data = await response.json();
        
        // Validate response
        if (!data.version || typeof data.version !== 'string') {
            console.warn('Version API returned invalid data:', data);
            return null;
        }
        
        return data.version;
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            console.warn('Version API request timed out');
        } else {
            console.warn('Version API fetch error:', error.message);
        }
        return null;
    }
};

/**
 * Get the current app version
 * This is a synchronous function that returns the best available version:
 * 1. Fresh cache (if available and not expired)
 * 2. Stale cache (if API fetching in background)
 * 3. Fallback version (if no cache available)
 * 
 * @returns {string} The current app version string
 */
export const getAppVersion = () => {
    const cached = getCachedVersion();
    
    if (cached && !cached.isStale) {
        // Fresh cache available
        return cached.version;
    }
    
    if (cached && cached.isStale) {
        // Stale cache - return it but trigger background refresh
        refreshVersionInBackground();
        return cached.version;
    }
    
    // No cache - return fallback (will be updated on next async call)
    return FALLBACK_VERSION;
};

/**
 * Async version of getAppVersion that always tries to fetch fresh data
 * Use this when you need the most up-to-date version
 * 
 * @returns {Promise<string>} The latest app version
 */
export const getAppVersionAsync = async () => {
    // Try to fetch fresh version
    const freshVersion = await fetchVersionFromAPI();
    
    if (freshVersion) {
        setCachedVersion(freshVersion);
        return freshVersion;
    }
    
    // Fetch failed - try cache (even if stale)
    const cached = getCachedVersion();
    if (cached) {
        return cached.version;
    }
    
    // Last resort - fallback
    return FALLBACK_VERSION;
};

/**
 * Refresh version in background without blocking
 */
const refreshVersionInBackground = () => {
    // Use a flag to prevent multiple concurrent refreshes
    if (window.__versionRefreshInProgress) return;
    window.__versionRefreshInProgress = true;
    
    fetchVersionFromAPI()
        .then((version) => {
            if (version) {
                setCachedVersion(version);
            }
        })
        .finally(() => {
            window.__versionRefreshInProgress = false;
        });
};

/**
 * Initialize version on app load
 * Call this once when the app starts to prime the cache
 */
export const initializeVersion = async () => {
    const cached = getCachedVersion();
    
    // If no cache or cache is stale, fetch fresh version
    if (!cached || cached.isStale) {
        await getAppVersionAsync();
    }
};

// ============================================================================
// Legacy exports for backward compatibility with existing code
// These will use the cached/fallback version synchronously
// ============================================================================

// APP_VERSION - this is now a getter that returns the current cached/fallback version
// Note: This is a constant for backward compatibility, but prefer using getAppVersion()
export const APP_VERSION = getAppVersion();

// This will be set during build time from the service worker
// For now, we'll store the version in localStorage when the app loads
export const getStoredVersion = () => {
    return localStorage.getItem('app_version') || getAppVersion();
};

export const setStoredVersion = (version) => {
    localStorage.setItem('app_version', version);
};

// Check if there's a version mismatch (update available)
export const hasVersionMismatch = () => {
    const storedVersion = getStoredVersion();
    const currentVersion = getAppVersion();
    return storedVersion !== currentVersion;
};

// Flag to show changelog after update
export const shouldShowChangelog = () => {
    return localStorage.getItem('show_changelog_after_update') === 'true';
};

export const setShowChangelogAfterUpdate = (value) => {
    if (value) {
        localStorage.setItem('show_changelog_after_update', 'true');
    } else {
        localStorage.removeItem('show_changelog_after_update');
    }
};

// Check if user has seen the current version's changelog
export const hasSeenCurrentChangelog = () => {
    const seenVersion = localStorage.getItem('changelog_seen_version');
    return seenVersion === getAppVersion();
};

export const markChangelogAsSeen = () => {
    localStorage.setItem('changelog_seen_version', getAppVersion());
};

// Check if there's a new version the user hasn't seen changelog for
export const hasUnseenChangelog = () => {
    return !hasSeenCurrentChangelog();
};

// ============================================================================
// Version comparison utilities
// ============================================================================

/**
 * Compare two semantic versions
 * @param {string} v1 - First version (e.g., "1.2.3")
 * @param {string} v2 - Second version (e.g., "1.2.4")
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export const compareVersions = (v1, v2) => {
    if (!v1 || !v2) return 0;
    
    // Strip any pre-release tags for comparison (e.g., "-beta")
    const clean = (v) => v.replace(/-[a-z0-9]+$/i, '');
    
    const parts1 = clean(v1).split('.').map(Number);
    const parts2 = clean(v2).split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    
    return 0;
};

/**
 * Check if a new version is available compared to stored version
 * @returns {boolean} True if a newer version is available
 */
export const isNewerVersionAvailable = () => {
    const storedVersion = getStoredVersion();
    const currentVersion = getAppVersion();
    return compareVersions(currentVersion, storedVersion) > 0;
};
