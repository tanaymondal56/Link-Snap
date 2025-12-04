import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, Download, Sparkles, AlertCircle, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  APP_VERSION,
  getStoredVersion,
  setStoredVersion,
  setShowChangelogAfterUpdate,
} from '../config/version';

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
  // Check PWA status on initial render
  const [isPWA] = useState(() => isInstalledPWA());
  const currentVersion = getStoredVersion();
  const newVersion = APP_VERSION;

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      console.log('SW Registered:', registration);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      // Set flag to show changelog after page reloads
      setShowChangelogAfterUpdate(true);
      // Update stored version to the new version
      setStoredVersion(APP_VERSION);
      await updateServiceWorker(true);
    } catch (error) {
      console.error('Failed to update:', error);
      setIsUpdating(false);
      setShowChangelogAfterUpdate(false);
    }
  };

  // Only show for installed PWA users when there's an update
  if (!needRefresh || !isPWA) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]" />

      {/* Update prompt */}
      <div className="fixed inset-0 flex items-center justify-center p-4 z-[9999]">
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
