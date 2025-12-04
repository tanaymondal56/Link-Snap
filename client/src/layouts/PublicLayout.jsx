import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Shield, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../api/axios';
import { APP_VERSION, hasUnseenChangelog, markChangelogAsSeen } from '../config/version';

const PublicLayout = () => {
  const { user, logout, openAuthModal, isAdmin } = useAuth();
  const [isWhitelistedIP, setIsWhitelistedIP] = useState(false);
  const [showNewBadge, setShowNewBadge] = useState(hasUnseenChangelog());

  // Check if current IP is whitelisted for admin access (only when not logged in)
  useEffect(() => {
    // Skip check if user is logged in - they'll see admin link via isAdmin
    if (user) return;

    let isMounted = true;

    const checkAdminAccess = async () => {
      try {
        // Use GET instead of HEAD for more reliable error responses
        await api.get('/admin/stats');
        // If we get here (200), user is authenticated AND whitelisted
        if (isMounted) setIsWhitelistedIP(true);
      } catch (error) {
        if (!isMounted) return;

        const status = error.response?.status;
        // 401 = IP allowed but not authenticated (this is what we want for localhost)
        // 403 = IP allowed but not admin role
        // 404 = IP blocked (route hidden)
        // No response = backend unreachable
        if (status === 401 || status === 403) {
          setIsWhitelistedIP(true);
        } else {
          setIsWhitelistedIP(false);
        }
      }
    };

    checkAdminAccess();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Reset whitelist state when user logs in (computed, not in effect)
  const showAdminLinkForWhitelistedIP = !user && isWhitelistedIP;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <nav className="border-b border-white/5 bg-gray-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
              >
                Link Snap
              </Link>
              {/* Version badge with What's New indicator */}
              <Link
                to="/changelog"
                onClick={() => {
                  markChangelogAsSeen();
                  setShowNewBadge(false);
                }}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 transition-all text-xs font-medium group relative"
              >
                {showNewBadge && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                )}
                <Sparkles className="w-3 h-3" />
                <span>v{APP_VERSION}</span>
                {showNewBadge ? (
                  <span className="text-emerald-400 text-[10px] font-semibold">
                    What&apos;s New
                  </span>
                ) : (
                  <span className="text-purple-400/50 text-[10px] group-hover:text-purple-300 transition-colors">
                    Changelog
                  </span>
                )}
              </Link>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {user ? (
                <>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-1.5 sm:gap-2 text-amber-400 hover:text-amber-300 px-2 sm:px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                      <span className="hidden sm:inline">Admin</span>
                    </Link>
                  )}
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-1.5 sm:gap-2 text-gray-300 hover:text-white px-2 sm:px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Link>
                  <button
                    onClick={logout}
                    className="text-gray-400 hover:text-white px-2 sm:px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <span className="hidden sm:inline">Logout</span>
                    <span className="sm:hidden">Exit</span>
                  </button>
                </>
              ) : (
                <>
                  {showAdminLinkForWhitelistedIP && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-1.5 sm:gap-2 text-amber-400/70 hover:text-amber-300 px-2 sm:px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      title="Admin Panel (Whitelisted IP)"
                    >
                      <Shield className="w-4 h-4" />
                      <span className="hidden sm:inline">Admin</span>
                    </Link>
                  )}
                  <button
                    onClick={() => openAuthModal('login')}
                    className="text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => openAuthModal('register')}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/20"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow relative">
        <Outlet />
      </main>

      <footer className="bg-gray-950 border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
          <div className="flex items-center gap-1">
            &copy; {new Date().getFullYear()}{' '}
            <span className="group cursor-pointer">
              <span className="font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent inline group-hover:hidden">
                Link Snap
              </span>
              <span className="hidden group-hover:inline font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent animate-pulse">
                Tanay&apos;s Creation 🚀
              </span>
            </span>
            <span className="text-gray-500">. All rights reserved.</span>
          </div>
          <div className="text-xs text-gray-600">
            <Link
              to="/changelog"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 transition-all"
            >
              <Sparkles size={12} />v{APP_VERSION}
            </Link>{' '}
            •{' '}
            <span className="inline-block relative whitespace-nowrap">
              <span className="animate-text-alternate">Made with ❤️</span>
              <span className="animate-text-alternate-reverse font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent whitespace-nowrap">
                Crafted by Tanay ✨
              </span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
