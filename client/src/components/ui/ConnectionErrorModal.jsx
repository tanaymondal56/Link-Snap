import { useState, useEffect, useCallback, useRef } from 'react';
import { ServerOff, WifiOff, RefreshCw, X, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const ConnectionErrorModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);
  const [countdown, setCountdown] = useState(10);
  const [isChecking, setIsChecking] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const timerRef = useRef(null);
  const backoffRef = useRef(10);

  const checkConnection = useCallback(async () => {
    if (isChecking) return false;
    setIsChecking(true);
    try {
      // Lightweight probe with cache busting and short timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      // Probe /api/health with cache-busting timestamp
      const res = await fetch(`/api/health?_t=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      }).catch(async () => {
        // Fallback probe to app root
        return fetch(`/?_t=${Date.now()}`, { method: 'HEAD', cache: 'no-store', signal: controller.signal });
      });

      clearTimeout(timeoutId);

      if (res && res.ok) {
        // Connection recovered!
        setIsRestored(true);
        setTimeout(() => {
          setIsOpen(false);
          setIsRestored(false);
          setErrorDetails(null);
          backoffRef.current = 10;
          window.dispatchEvent(new CustomEvent('app:connection-restored'));
        }, 1200);
        return true;
      }
    } catch {
      // Still unreachable
    } finally {
      setIsChecking(false);
    }
    return false;
  }, [isChecking]);

  // Listen for connection error events from axios
  useEffect(() => {
    let lastEventTime = 0;

    const handleConnectionError = (e) => {
      const now = Date.now();
      // Throttle event bursts (ignore duplicate error signals within 2.5s)
      if (now - lastEventTime < 2500 && isOpen) {
        return;
      }
      lastEventTime = now;

      const detail = e.detail || {};
      setErrorDetails(detail);
      setIsOpen(true);
      setCountdown(backoffRef.current);
    };

    const handleOnline = () => {
      // Immediate probe when browser signals online
      if (isOpen) {
        checkConnection();
      }
    };

    window.addEventListener('app:connection-error', handleConnectionError);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('app:connection-error', handleConnectionError);
      window.removeEventListener('online', handleOnline);
    };
  }, [isOpen, checkConnection]);

  // Countdown timer for automatic retry
  useEffect(() => {
    if (!isOpen || isRestored) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Timer reached zero -> perform automatic check
          checkConnection().then((recovered) => {
            if (!recovered) {
              // Increase backoff slightly up to 30s
              backoffRef.current = Math.min(backoffRef.current + 5, 30);
              setCountdown(backoffRef.current);
            }
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, isRestored, checkConnection]);

  if (!isOpen) return null;

  const isServerDown =
    errorDetails?.status >= 500 ||
    errorDetails?.code === 'ERR_CONNECTION_REFUSED' ||
    errorDetails?.code === 'ECONNREFUSED';

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        data-modal-content
        className="relative w-full max-w-md bg-gray-900/95 border border-red-500/30 rounded-2xl shadow-2xl shadow-red-950/40 overflow-hidden flex flex-col animate-modal-in"
      >
        {/* Top Glow Bar */}
        <div
          className={`h-1.5 bg-gradient-to-r ${
            isRestored
              ? 'from-emerald-500 to-green-400'
              : 'from-red-500 via-orange-500 to-amber-500'
          }`}
        />

        <div className="p-6">
          {/* Header Icon */}
          <div className="flex justify-center mb-5">
            <div
              className={`p-4 rounded-2xl ring-4 ${
                isRestored
                  ? 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/10'
                  : isServerDown
                  ? 'bg-rose-500/20 text-rose-400 ring-rose-500/10'
                  : 'bg-amber-500/20 text-amber-400 ring-amber-500/10'
              } transition-all duration-300`}
            >
              {isRestored ? (
                <CheckCircle2 className="w-9 h-9 animate-scale-in" />
              ) : isServerDown ? (
                <ServerOff className="w-9 h-9 animate-pulse" />
              ) : (
                <WifiOff className="w-9 h-9 animate-pulse" />
              )}
            </div>
          </div>

          {/* Title & Status Badge */}
          <div className="text-center mb-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-gray-800 text-gray-300 border border-gray-700 mb-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              {isRestored
                ? 'Connection Restored'
                : isServerDown
                ? errorDetails?.status
                  ? `Server Response ${errorDetails.status}`
                  : 'API Unreachable'
                : 'Network Disrupted'}
            </div>
            <h3 className="text-xl font-bold text-white">
              {isRestored
                ? 'Back Online!'
                : isServerDown
                ? 'Server Temporarily Unavailable'
                : 'Unable to Connect'}
            </h3>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-400 text-center leading-relaxed mb-6">
            {isRestored
              ? 'Successfully reconnected to Link-Snap services. Resuming normal operations...'
              : isServerDown
              ? 'The Link-Snap API is currently undergoing maintenance or restarting. Your data is safe and offline features remain active.'
              : 'Could not establish a secure connection with the server. Please check your internet connection or Wi-Fi.'}
          </p>

          {/* Action Buttons & Countdown */}
          {!isRestored && (
            <div className="space-y-3">
              <button
                onClick={() => checkConnection()}
                disabled={isChecking}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                {isChecking
                  ? 'Testing connection...'
                  : countdown > 0
                  ? `Retry Now (Auto in ${countdown}s)`
                  : 'Retry Connection'}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-2.5 px-4 bg-gray-800/80 hover:bg-gray-800 text-gray-400 hover:text-white text-xs font-medium rounded-xl transition-colors border border-gray-700/50"
              >
                Dismiss and Continue Offline
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectionErrorModal;
