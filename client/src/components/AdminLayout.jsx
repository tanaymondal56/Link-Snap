import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Loader2, Mail, Lock, ArrowRight, ShieldX } from 'lucide-react';

const AdminLayout = () => {
  const { user, login, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [isAllowedIP, setIsAllowedIP] = useState(null);

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Add noindex meta tag to prevent search engines from indexing admin pages
  useEffect(() => {
    const metaRobots = document.createElement('meta');
    metaRobots.name = 'robots';
    metaRobots.content = 'noindex, nofollow';
    document.head.appendChild(metaRobots);

    return () => {
      document.head.removeChild(metaRobots);
    };
  }, []);

  // Check if the current IP is allowed to access admin routes
  useEffect(() => {
    const checkAccess = async () => {
      try {
        // We use a HEAD request to check if the route exists (IP allowed)
        // If IP is blocked, backend returns 404.
        // If IP is allowed but not auth, backend returns 401.
        // If IP is allowed and auth, backend returns 200.
        await api.head('/admin/stats');
        setIsAllowedIP(true);
      } catch (error) {
        // If backend is unreachable (no response), block access for security
        if (!error.response) {
          // Network error, timeout, or backend down - DENY access
          console.warn('[Admin] Backend unreachable, denying access for security');
          setIsAllowedIP(false);
          return;
        }

        if (error.response.status === 404) {
          // Backend explicitly returned 404 (IP Blocked or Route Hidden)
          setIsAllowedIP(false);
        } else {
          // 401, 403, 500 etc. implies the route exists, so IP is allowed
          // We handle auth state separately
          setIsAllowedIP(true);
        }
      }
    };
    checkAccess();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoginLoading(true);
    setLoginError('');
    try {
      const result = await login(email, password);
      if (!result.success) {
        setLoginError(result.error || 'Invalid credentials');
      }
      // On success, component will re-render with user set
    } catch {
      setLoginError('Login failed');
    } finally {
      setIsLoginLoading(false);
    }
  };

  if (authLoading || isAllowedIP === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  // 1. IP Blocked -> Show 404 to hide existence
  if (!isAllowedIP) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-600">404</h1>
          <p className="text-xl text-gray-400 mt-4">Page Not Found</p>
          <a href="/" className="mt-6 inline-block text-purple-400 hover:text-purple-300">
            Go Home
          </a>
        </div>
      </div>
    );
  }

  // 2. IP Allowed, but Not Logged In -> Show Inline Login Form
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="max-w-md w-full space-y-8 glass-dark p-8 rounded-2xl shadow-2xl border border-white/10">
          <div className="text-center">
            <h2 className="mt-2 text-3xl font-bold text-white">Admin Access</h2>
            <p className="mt-2 text-sm text-gray-400">Please verify your identity to continue</p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            {loginError && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm text-center">
                {loginError}
              </div>
            )}
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-purple-400 transition-colors" />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl leading-5 bg-gray-900/50 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 focus:bg-gray-900/80 transition-all duration-200 sm:text-sm"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-purple-400 transition-colors" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl leading-5 bg-gray-900/50 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 focus:bg-gray-900/80 transition-all duration-200 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoginLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-purple-500/25"
              >
                {isLoginLoading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  <span className="flex items-center">
                    Access Panel{' '}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 3. IP Allowed & Logged In, but NOT Admin -> Show Access Denied
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="max-w-md w-full text-center glass-dark p-8 rounded-2xl shadow-2xl border border-red-500/20">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldX className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-6">
            You don't have permission to access the admin panel. This area is restricted to
            administrators only.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-xl transition-all duration-200"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl transition-all duration-200"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. IP Allowed & Logged In & Is Admin -> Show Admin Panel
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            Admin Panel
          </h1>
          <div className="flex gap-4">
            <a href="/dashboard" className="text-gray-300 hover:text-white transition-colors">
              Back to App
            </a>
          </div>
        </div>
      </nav>
      <main className="container mx-auto p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
