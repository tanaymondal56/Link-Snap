import { Component } from 'react';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react';
import OfflineRouteFallback from './ui/OfflineRouteFallback';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    };
  }

  static getDerivedStateFromError(error) {
    const isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
    return { hasError: true, error, isOffline };
  }

  componentDidMount() {
    window.addEventListener('online', this.handleNetworkOnline);
    window.addEventListener('offline', this.handleNetworkOffline);
    window.addEventListener('popstate', this.handlePopState);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleNetworkOnline);
    window.removeEventListener('offline', this.handleNetworkOffline);
    window.removeEventListener('popstate', this.handlePopState);
  }

  handlePopState = () => {
    if (this.state.hasError) {
      this.setState({ hasError: false, error: null, errorInfo: null, isOffline: false });
    }
  };

  handleNetworkOnline = () => {
    this.setState({ isOffline: false });
    // If the error was caused by an offline chunk load, auto-recover on reconnect
    if (this.state.hasError) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  handleNetworkOffline = () => {
    this.setState({ isOffline: true });
  };

  handleGoBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      this.handleGoHome();
    }
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, isOffline: false });
    if (typeof window !== 'undefined') {
      if (window.location.pathname !== '/') {
        window.history.pushState(null, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      } else if (navigator.onLine) {
        window.location.reload();
      }
    }
  };

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Automatically recover from chunk loading errors (usually caused by new deployments)
    const isChunkError = 
      error.name === 'ChunkLoadError' ||
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Expected a JavaScript-or-Wasm module');

    if (isChunkError) {
      // NEVER reload when offline! Reloading offline drops the PWA shell into the browser dinosaur page
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.warn('[ErrorBoundary] Chunk error while offline. Preserving PWA shell in offline state.');
        this.setState({ isOffline: true });
        return;
      }

      const lastReload = sessionStorage.getItem('chunk_error_reload_time');
      const now = Date.now();
      
      if (!lastReload || now - parseInt(lastReload, 10) > 20000) {
        sessionStorage.setItem('chunk_error_reload_time', now.toString());
        console.warn('Chunk load error detected while online. Triggering reload to retrieve latest assets...');
        // Request SW update without unregistering
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach((reg) => reg.update().catch(() => {}));
          }).catch(() => {});
        }
        window.location.reload();
      } else {
        console.error('Chunk load error persisted. Cooldown active. Showing error screen.');
      }
    }
  }

  handleRefresh = () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setState({ isOffline: true });
      return;
    }
    window.location.reload();
  };

  handleClearCache = async () => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.setState({ isOffline: true });
        return;
      }
      // Request active service workers to update rather than killing them
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.update().catch(() => {})));
      }
      window.location.reload();
    } catch (err) {
      console.error('Failed to update service worker:', err);
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // If offline, render our branded OfflineRouteFallback instead of the crash screen
      if (this.state.isOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        return (
          <OfflineRouteFallback
            onRetry={() => {
              if (typeof navigator !== 'undefined' && navigator.onLine) {
                window.location.reload();
              } else {
                this.setState({ isOffline: true });
              }
            }}
            onBack={this.handleGoBack}
            onHome={this.handleGoHome}
          />
        );
      }
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
          {/* Background Effects */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-red-600/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-orange-600/10 rounded-full blur-[120px]" />
          </div>

          <div className="relative z-10 max-w-md w-full text-center">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-red-500/20 rounded-2xl ring-4 ring-gray-900">
                <AlertTriangle className="w-12 h-12 text-red-400" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">Something went wrong</h1>

            {/* Message */}
            <p className="text-gray-400 mb-8">
              We encountered an unexpected error. This might be due to a temporary issue or cached
              data.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRefresh}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-xl transition-all shadow-lg"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Page
              </button>

              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-medium rounded-xl transition-all border border-gray-700"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>

            {/* Clear Cache Option */}
            <button
              onClick={this.handleClearCache}
              className="mt-6 text-sm text-gray-500 hover:text-gray-400 underline transition-colors"
            >
              Clear cache and reload
            </button>

            {/* Debug Info (only in development) */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-8 text-left">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-400">
                  Technical Details
                </summary>
                <pre className="mt-2 p-4 bg-gray-900/50 border border-gray-800 rounded-lg text-xs text-red-400 overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
