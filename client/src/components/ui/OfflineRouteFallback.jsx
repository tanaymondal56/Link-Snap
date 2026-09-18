import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, Home, ArrowLeft } from 'lucide-react';

/**
 * Branded in-app offline fallback component.
 * Rendered when a route or chunk fails to load due to network disconnection.
 * Automatically recovers when the browser fires the 'online' event.
 */
export const OfflineRouteFallback = ({ onRetry }) => {
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      // Auto-recover immediately when connection returns
      if (onRetry) {
        onRetry();
      } else {
        window.location.reload();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [onRetry]);

  const handleManualRetry = async () => {
    setIsRetrying(true);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setTimeout(() => {
        setIsRetrying(false);
      }, 500);
      return;
    }
    try {
      if (onRetry) {
        await onRetry();
      } else {
        window.location.reload();
      }
    } finally {
      setTimeout(() => {
        setIsRetrying(false);
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {/* Ambient background glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-md w-full text-center">
        {/* Glowing Icon */}
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl ring-4 ring-gray-900 shadow-xl shadow-amber-950/20">
            <WifiOff className="w-12 h-12 text-amber-400 animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-900 border border-gray-800 text-amber-400 mb-3">
          No Internet Connection
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
          You're Offline
        </h1>

        {/* Message */}
        <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
          This section of Link-Snap requires an active internet connection to download.
          We will automatically reconnect as soon as you're back online.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleManualRetry}
            disabled={isRetrying}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl transition-all shadow-lg active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Connecting...' : 'Retry Connection'}
          </button>

          <button
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = '/';
              }
            }}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white font-medium rounded-xl transition-all border border-gray-800 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>

        {/* Quick Nav to cached home */}
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-400 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            Return to Link-Snap Home
          </a>
        </div>
      </div>
    </div>
  );
};

export default OfflineRouteFallback;
