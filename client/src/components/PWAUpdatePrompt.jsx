import { useState, useEffect, useRef, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, Download, Sparkles, AlertCircle, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getStoredVersion,
  setStoredVersion,
  setShowChangelogAfterUpdate,
} from '../config/version';
import { useAppVersion } from '../hooks/useAppVersion';

// Unique ID for the update overlay to track DOM manipulation
const UPDATE_OVERLAY_ID = '__pwa_update_overlay__';
const UPDATE_BLOCKER_ID = '__pwa_update_blocker__';

// Check if the app is running as an installed PWA (standalone mode)
const isInstalledPWA = () => {
  // Check display-mode media query (works on most browsers)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  // Check for iOS standalone mode
  if (window.navigator.standalone === true) {
    return true;
  }
  // Check if launched from TWA (Trusted Web Activity) on Android
  if (document.referrer.includes('android-app://')) {
    return true;
  }
  return false;
};

const PWAUpdatePrompt = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [forceRender, setForceRender] = useState(0);
  // Check PWA status on initial render
  const [isPWA] = useState(() => isInstalledPWA());
  // Track if we've detected an update (persisted in sessionStorage)
  const [hasUpdate, setHasUpdate] = useState(() => {
    return sessionStorage.getItem('pwa_update_available') === 'true';
  });
  const currentVersion = getStoredVersion();
  const appVersion = useAppVersion();
  const newVersion = appVersion;
  const overlayRef = useRef(null);
  const blockerRef = useRef(null);
  const observerRef = useRef(null);

  // Use prompt mode - needRefresh becomes true when update is available
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      console.log('[PWA] SW Registered:', registration);
      
      if (registration) {
        // Check for updates immediately
        registration.update();
        
        // Then check every 60 seconds
        setInterval(() => {
          console.log('[PWA] Checking for SW updates...');
          registration.update();
        }, 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.log('[PWA] SW registration error:', error);
    },
    onNeedRefresh() {
      console.log('[PWA] New content available - will update automatically');
      setHasUpdate(true);
      sessionStorage.setItem('pwa_update_available', 'true');
    },
    onOfflineReady() {
      console.log('[PWA] App ready for offline use');
    },
  });

  // Check for version mismatch (most reliable method)
  const hasVersionMismatch = currentVersion !== newVersion;
  
  // Debug logging
  useEffect(() => {
    console.log('[PWA Debug] isPWA:', isPWA);
    console.log('[PWA Debug] needRefresh:', needRefresh);
    console.log('[PWA Debug] hasUpdate (persisted):', hasUpdate);
    console.log('[PWA Debug] currentVersion (localStorage):', currentVersion);
    console.log('[PWA Debug] newVersion (code):', newVersion);
    console.log('[PWA Debug] hasVersionMismatch:', hasVersionMismatch);
  }, [isPWA, needRefresh, hasUpdate, currentVersion, newVersion, hasVersionMismatch]);

  // If version mismatch detected in PWA mode, show update prompt
  const shouldBlock = isPWA && (hasVersionMismatch || needRefresh || hasUpdate);

  // Create the blocker element to prevent any interaction with the app
  const ensureBlockerExists = useCallback(() => {
    if (!shouldBlock) return;
    
    let blocker = document.getElementById(UPDATE_BLOCKER_ID);
    if (!blocker) {
      blocker = document.createElement('div');
      blocker.id = UPDATE_BLOCKER_ID;
      blocker.style.cssText = `
        position: fixed !important;
        inset: 0 !important;
        z-index: 9997 !important;
        pointer-events: all !important;
        background: transparent !important;
      `;
      // Prevent all pointer events from reaching the app
      blocker.addEventListener('click', (e) => e.stopPropagation(), true);
      blocker.addEventListener('mousedown', (e) => e.stopPropagation(), true);
      blocker.addEventListener('mouseup', (e) => e.stopPropagation(), true);
      blocker.addEventListener('touchstart', (e) => e.stopPropagation(), true);
      blocker.addEventListener('touchend', (e) => e.stopPropagation(), true);
      blocker.addEventListener('keydown', (e) => {
        // Only allow specific keys for the update button
        if (e.target.id !== 'pwa-update-button') {
          e.stopPropagation();
        }
      }, true);
      document.body.appendChild(blocker);
    }
    blockerRef.current = blocker;
  }, [shouldBlock]);

  // Tamper detection: Monitor for DOM manipulation
  useEffect(() => {
    if (!shouldBlock) return;

    // Block scroll on body
    document.body.style.overflow = 'hidden';
    
    // Ensure blocker exists
    ensureBlockerExists();

    // Set up MutationObserver to detect when overlay is removed
    observerRef.current = new MutationObserver(() => {
      const overlayExists = document.getElementById(UPDATE_OVERLAY_ID);
      const blockerExists = document.getElementById(UPDATE_BLOCKER_ID);
      
      if (!overlayExists || !blockerExists) {
        // Someone tried to remove the overlay via DevTools - force re-render
        console.warn('[PWA Update] Tampering detected - re-rendering overlay');
        ensureBlockerExists();
        setForceRender((prev) => prev + 1);
      }
    });

    // Observe the entire document for removed nodes
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also set up an interval as a backup detection mechanism
    const intervalId = setInterval(() => {
      const overlayExists = document.getElementById(UPDATE_OVERLAY_ID);
      const blockerExists = document.getElementById(UPDATE_BLOCKER_ID);
      
      if (!overlayExists || !blockerExists) {
        ensureBlockerExists();
        setForceRender((prev) => prev + 1);
      }
    }, 500);

    return () => {
      document.body.style.overflow = '';
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      clearInterval(intervalId);
      // Clean up blocker
      const blocker = document.getElementById(UPDATE_BLOCKER_ID);
      if (blocker) {
        blocker.remove();
      }
    };
  }, [shouldBlock, ensureBlockerExists]);

  // Prevent keyboard shortcuts that might close overlay
  useEffect(() => {
    if (!shouldBlock) return;

    const handleKeyDown = (e) => {
      // Allow Tab and Enter for accessibility on the update button
      if (e.target.id === 'pwa-update-button') {
        return;
      }
      // Block most keyboard interactions
      if (e.key === 'Escape' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [shouldBlock]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      // Clear the update available flag
      sessionStorage.removeItem('pwa_update_available');
      // Set flag to show changelog after page reloads
      setShowChangelogAfterUpdate(true);
      // Update stored version to the new version
      setStoredVersion(appVersion);
      
      // Try to update the service worker first
      try {
        await updateServiceWorker(true);
      } catch (swError) {
        console.log('[PWA] SW update skipped, doing hard reload:', swError);
      }
      
      // Force a hard reload to get the latest content
      // This clears the browser cache for this page
      window.location.reload();
    } catch (error) {
      console.error('Failed to update:', error);
      setIsUpdating(false);
      setShowChangelogAfterUpdate(false);
      // Restore the flag if update failed
      sessionStorage.setItem('pwa_update_available', 'true');
    }
  };

  // Only show for installed PWA users when there's an update
  if (!shouldBlock) return null;

  return (
    <>
      {/* Backdrop overlay - with ID for tamper detection */}
      <div 
        id={UPDATE_OVERLAY_ID}
        ref={overlayRef}
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9998]" 
        style={{ pointerEvents: 'none' }}
        data-force-render={forceRender}
      />

      {/* Update prompt */}
      <div 
        className="fixed inset-0 flex items-center justify-center p-4 z-[9999]"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="w-full max-w-sm bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 rounded-2xl shadow-2xl shadow-purple-500/30 border border-purple-400/20 overflow-hidden animate-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="px-5 py-4 flex items-center gap-3 border-b border-white/10">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Update Required</h2>
              <p className="text-white/60 text-xs">New version available</p>
            </div>
          </div>

          {/* Content */}
          <div className="px-5 py-5">
            {/* Version badges */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="text-center">
                <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Current</p>
                <span className="px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-mono">
                  v{currentVersion}
                </span>
              </div>
              <div className="text-white/30">→</div>
              <div className="text-center">
                <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">New</p>
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono border border-emerald-500/30">
                  v{newVersion}
                </span>
              </div>
            </div>

            {/* Alert box */}
            <div className="bg-white/10 rounded-xl p-3 mb-4 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
              <p className="text-white/90 text-sm leading-relaxed">
                An important update is available. Please update now to continue using Link Snap with
                all features working correctly.
              </p>
            </div>

            {/* Changelog link */}
            <Link
              to="/changelog"
              target="_blank"
              className="flex items-center justify-center gap-1.5 text-white/50 hover:text-white/80 text-xs mb-5 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>See what&apos;s new in this update</span>
            </Link>

            {/* Update button */}
            <button
              id="pwa-update-button"
              onClick={handleUpdate}
              disabled={isUpdating}
              className="w-full px-4 py-3 rounded-xl bg-white text-purple-600 text-sm font-bold hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-70 shadow-lg shadow-black/20"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Update Now
                </>
              )}
            </button>
          </div>

          {/* Progress bar for visual feedback */}
          {isUpdating && (
            <div className="h-1 bg-white/20 overflow-hidden">
              <div className="h-full bg-white animate-pulse w-full" />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PWAUpdatePrompt;

