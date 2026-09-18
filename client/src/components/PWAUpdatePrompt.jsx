import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Download, Sparkles, AlertCircle, FileText } from 'lucide-react';
import { Link } from 'react-router';
import { getStoredVersion, setStoredVersion, setShowChangelogAfterUpdate } from '../config/version';
import { useAppVersion } from '../hooks/useAppVersion';

// Check if the app is running as an installed PWA (standalone mode)
const isInstalledPWA = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
};

const PWAUpdatePrompt = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  // Check PWA status on initial render
  const [isPWA] = useState(() => isInstalledPWA());
  // Track if the SW signalled a new version is waiting
  const [swNeedsRefresh, setSwNeedsRefresh] = useState(false);
  const currentVersion = getStoredVersion();
  const appVersion = useAppVersion();
  const newVersion = appVersion;

  // Check for version mismatch (most reliable method)
  const hasVersionMismatch = currentVersion !== newVersion;

  // Show prompt when there's genuinely something new —
  // either the API reports a newer version OR the SW flagged a waiting worker.
  const shouldBlock =
    (isPWA || isSimulated) && (hasVersionMismatch || swNeedsRefresh);

  // After a successful reload the versions should match — clear leftover flags
  // so the prompt doesn't reappear for the same version.
  useEffect(() => {
    if (!hasVersionMismatch && !swNeedsRefresh) {
      sessionStorage.removeItem('pwa_update_available');
    }
  }, [hasVersionMismatch, swNeedsRefresh]);

  // Prevent keyboard shortcuts that might close overlay
  useEffect(() => {
    if (!shouldBlock) return;

    const handleKeyDown = (e) => {
      // Block most keyboard interactions
      if (e.key === 'Escape' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [shouldBlock]);

  // Listen for background SW refresh signal from pwa.js
  useEffect(() => {
    const handleNeedRefresh = () => {
      setSwNeedsRefresh(true);
    };
    window.addEventListener('pwa-need-refresh', handleNeedRefresh);
    return () => window.removeEventListener('pwa-need-refresh', handleNeedRefresh);
  }, []);

  // Listen for manual simulation trigger from DevCommandCenter
  useEffect(() => {
    const handleManualTrigger = () => {
      console.log('[PWA] Manual update simulation triggered');
      setIsSimulated(true);
      setSwNeedsRefresh(true);
    };

    window.addEventListener('pwa-update-manual-trigger', handleManualTrigger);
    return () => window.removeEventListener('pwa-update-manual-trigger', handleManualTrigger);
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      // Clear all update flags so prompt doesn't re-appear after reload
      sessionStorage.removeItem('pwa_update_available');
      setSwNeedsRefresh(false);
      // Set flag to show changelog after page reloads
      setShowChangelogAfterUpdate(true);
      // Update stored version to the new version
      setStoredVersion(appVersion);

      let reloaded = false;
      const triggerReload = () => {
        if (!reloaded) {
          reloaded = true;
          window.location.reload();
        }
      };

      // Listen for the waiting SW to take control before reloading
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', triggerReload, { once: true });
      }

      // Tell the waiting Service Worker to skipWaiting
      try {
        const { updateAppServiceWorker } = await import('../pwa');
        await updateAppServiceWorker(true);
      } catch {
        triggerReload();
      }

      // Safety fallback: if no waiting worker claims controller within 2s, force reload
      setTimeout(triggerReload, 2000);
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

  // Use Portal to render at the end of body, ensuring reliable z-index stacking
  return createPortal(
    <div className="fixed inset-0 z-[9999] font-sans">
      {/* Backdrop overlay - Blocks all interactions behind it */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
        style={{ pointerEvents: 'auto' }}
      />

      {/* Update prompt - Centered and Interactive */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-sm bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 rounded-2xl shadow-2xl shadow-purple-500/30 border border-purple-400/20 overflow-hidden animate-in zoom-in-95 duration-300 pointer-events-auto">
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
              onClick={handleUpdate}
              disabled={isUpdating}
              className="w-full px-4 py-3 rounded-xl bg-white text-purple-600 text-sm font-bold hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-70 shadow-lg shadow-black/20 cursor-pointer"
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
    </div>,
    document.body
  );
};

export default PWAUpdatePrompt;
