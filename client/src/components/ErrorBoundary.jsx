import { Component } from 'react';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleClearCache = async () => {
    try {
      // Clear service worker cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }

      // Clear localStorage (but preserve essential data)
      const accessToken = localStorage.getItem('accessToken');
      localStorage.clear();
      if (accessToken) localStorage.setItem('accessToken', accessToken);

      // Reload the page
      window.location.reload();
    } catch (err) {
      console.error('Failed to clear cache:', err);
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
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
