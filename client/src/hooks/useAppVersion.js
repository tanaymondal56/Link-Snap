import { useSyncExternalStore } from 'react';
import { getAppVersionAsync, getAppVersion } from '../config/version';

// ============================================================================
// Singleton pattern: Share version state across all hook instances
// This prevents multiple API calls when the hook is used in multiple components
// ============================================================================

// Global state - shared across all useAppVersion instances
let currentVersion = getAppVersion();
const listeners = new Set();

// Notify all subscribed components when version changes
const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

// Subscribe function for useSyncExternalStore
const subscribe = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

// Snapshot function for useSyncExternalStore
const getSnapshot = () => currentVersion;

// Initialize: fetch version once on module load (ESM modules are singletons)
getAppVersionAsync().then((latestVersion) => {
  if (latestVersion && latestVersion !== currentVersion) {
    currentVersion = latestVersion;
    notifyListeners();
  }
});

/**
 * React hook that returns the current app version reactively.
 * Uses singleton pattern - multiple components share the same API call.
 * 
 * Initially returns the cached/fallback version, then updates when fetch completes.
 * 
 * Usage:
 *   const version = useAppVersion();
 *   return <span>v{version}</span>;
 */
export const useAppVersion = () => {
  // useSyncExternalStore ensures all components see the same version
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export default useAppVersion;
