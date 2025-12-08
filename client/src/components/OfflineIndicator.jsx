import { useState, useEffect, createContext, useContext } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

// Context to check offline status from anywhere in the app
const OfflineContext = createContext({ isOffline: false });

// eslint-disable-next-line react-refresh/only-export-components
export const useOffline = () => useContext(OfflineContext);

/**
 * Offline Indicator Component - Hybrid Approach
 * - Pill indicator at top
 * - Subtle grayscale overlay (non-blocking for reading/scrolling)
 * - Provides context for blocking network actions
 */
const OfflineIndicator = ({ children }) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showOnlineConfirmation, setShowOnlineConfirmation] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // Show brief "back online" confirmation
      setShowOnlineConfirmation(true);
      setTimeout(() => setShowOnlineConfirmation(false), 2000);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <OfflineContext.Provider value={{ isOffline }}>
      {/* Subtle Grayscale Overlay when offline */}
      {isOffline && (
        <div 
          className="fixed inset-0 z-[9998] pointer-events-none transition-all duration-500"
          style={{
            backdropFilter: 'grayscale(70%) brightness(0.9)',
            WebkitBackdropFilter: 'grayscale(70%) brightness(0.9)',
          }}
        />
      )}

      {/* Floating Pill Indicator */}
      {(isOffline || showOnlineConfirmation) && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] transform transition-all duration-300 ${
            isOffline || showOnlineConfirmation
              ? 'translate-y-0 opacity-100 scale-100'
              : '-translate-y-4 opacity-0 scale-95'
          }`}
        >
          <div
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full shadow-2xl backdrop-blur-xl border ${
              isOffline
                ? 'bg-gray-900/90 border-red-500/40 text-white'
                : 'bg-gray-900/90 border-green-500/40 text-white'
            }`}
          >
            {isOffline ? (
              <>
                <div className="relative flex items-center justify-center">
                  <WifiOff className="w-4 h-4 text-red-400" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold leading-tight">You're Offline</span>
                  <span className="text-xs text-gray-400 leading-tight">Check your connection</span>
                </div>
              </>
            ) : (
              <>
                <div className="relative flex items-center justify-center">
                  <Wifi className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-sm font-semibold">Back Online!</span>
              </>
            )}
          </div>
        </div>
      )}

      {children}
    </OfflineContext.Provider>
  );
};

export default OfflineIndicator;
