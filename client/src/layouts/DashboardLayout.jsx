import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Link as LinkIcon,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  Globe,
  Lock,
} from 'lucide-react';
import { cn } from '../utils/cn';

import { Loader2 } from 'lucide-react';

import LazyPullToRefresh from '../components/LazyPullToRefresh';
import OfflineIndicator from '../components/OfflineIndicator';
const CreateLinkModal = lazy(() => import('../components/CreateLinkModal'));
const LinkSuccessModal = lazy(() => import('../components/LinkSuccessModal'));

const DashboardLayout = () => {
  const { user, logout, loading, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [createdLink, setCreatedLink] = useState(null);
  const adminTriggerTimer = useRef(null); // For hidden admin recovery trigger

  const handleLinkCreated = (newLink) => {
    setCreatedLink(newLink);
    // Success modal logic is handled by the CreateLinkModal's parent usually,
    // but here we need to manage it since we are the parent.
    // Wait, CreateLinkModal doesn't open success modal itself?
    // Let's check UserDashboard usage.
    // UserDashboard: setCreatedLink(newLink). And renders LinkSuccessModal independently.
    // So we need to set createdLink and open SuccessModal.
    // Actually checking UserDashboard again...
    //   const handleLinkCreated = (newLink) => {
    //     setLinks([newLink, ...links]);
    //     setCreatedLink(newLink);
    //   };
    // And: <LinkSuccessModal isOpen={!!createdLink} onClose={() => setCreatedLink(null)} linkData={createdLink} />
    // So setting createdLink is enough if we use that pattern.
  };

  // Redirect to home if not logged in (don't force auth modal)
  // Don't redirect if there's a token being validated
  useEffect(() => {
    const hasToken = localStorage.getItem('accessToken');
    if (!loading && !user && !hasToken) {
      navigate('/', { replace: true });
    }
  }, [loading, user, navigate]);

  // Check if there's a token but user isn't set yet (still loading)
  // This prevents redirect to home when refreshing while logged in
  const hasToken = typeof window !== 'undefined' && localStorage.getItem('accessToken');
  const isStillLoading = loading || (hasToken && !user);

  if (isStillLoading)
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <Loader2 className="animate-spin h-10 w-10 text-blue-500" />
      </div>
    );

  if (!user) return null; // Will redirect via useEffect

  const navigation = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Links', href: '/dashboard/links', icon: LinkIcon },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  // Only add Bio Page for normal users
  if (user?.role !== 'master_admin') {
    navigation.splice(3, 0, {
      name: 'Bio Page',
      href: '/dashboard/bio',
      icon: Globe,
      isProFeature: true,
    });
  }

  // Check if user has Pro/Business tier
  const userTier = user?.subscription?.tier || 'free';

  // Add admin panel link for admin users
  if (isAdmin) {
    navigation.push({ name: 'Admin Panel', href: '/admin', icon: Shield, isAdmin: true });
  }

  return (
    <div className="h-screen bg-gray-950 text-white flex font-sans selection:bg-purple-500/30 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Fixed */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-gray-900/95 backdrop-blur-xl border-r border-white/5 flex flex-col shadow-2xl lg:shadow-none will-change-transform',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          'transition-transform duration-300 ease-out'
        )}
      >
        <div className="h-20 flex items-center px-6 border-b border-white/5">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all">
              <LinkIcon size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              LinkSnap
            </span>
          </Link>
          <button
            className="ml-auto lg:hidden text-gray-400 hover:text-white transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <button
            onClick={() => {
              setIsCreateModalOpen(true);
              setIsSidebarOpen(false); // Close sidebar on mobile when clicked
            }}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-3 px-4 rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <LinkIcon size={18} />
            <span>New Link</span>
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? item.isAdmin
                      ? 'bg-amber-500/20 text-amber-300 shadow-inner border border-amber-500/30'
                      : 'bg-white/10 text-white shadow-inner border border-white/5'
                    : item.isAdmin
                      ? 'text-amber-400/70 hover:bg-amber-500/10 hover:text-amber-300 hover:translate-x-1'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white hover:translate-x-1'
                )}
              >
                <item.icon
                  size={20}
                  className={cn(
                    isActive
                      ? item.isAdmin
                        ? 'text-amber-400'
                        : 'text-blue-400'
                      : item.isAdmin
                        ? 'text-amber-500/50'
                        : 'text-gray-500 group-hover:text-gray-300'
                  )}
                />
                <span className="flex items-center gap-2">
                  {item.name}
                  {item.isProFeature && userTier === 'free' && (
                    <Lock size={14} className="text-amber-400/70" />
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 bg-black/20">
          <div className="flex items-center gap-3 px-3 py-2 mb-3 rounded-lg bg-white/5 border border-white/5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold shadow-inner">
              {user.firstName ? user.firstName[0].toUpperCase() : user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              {(user.firstName || user.lastName) && (
                <p className="text-sm font-semibold text-white truncate">
                  {user.firstName} {user.lastName}
                </p>
              )}
              <p
                className={`text-sm ${user.firstName || user.lastName ? 'text-gray-400' : 'text-white font-medium'} truncate`}
              >
                {user.email}
              </p>
              <p className="text-xs text-gray-400 capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
          {/* Hidden Admin Recovery Trigger - Long press for 3s */}
          <p
            className="text-[10px] text-gray-400 text-center mt-4 select-none cursor-default"
            onTouchStart={() => {
              adminTriggerTimer.current = setTimeout(() => {
                if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                navigate('/admin?auth=bio');
              }, 3000);
            }}
            onTouchEnd={() => {
              clearTimeout(adminTriggerTimer.current);
            }}
            onMouseDown={() => {
              adminTriggerTimer.current = setTimeout(() => {
                navigate('/admin?auth=bio');
              }, 3000);
            }}
            onMouseUp={() => {
              clearTimeout(adminTriggerTimer.current);
            }}
            onMouseLeave={() => {
              clearTimeout(adminTriggerTimer.current);
            }}
          >
            © {new Date().getFullYear()} Link Snap
          </p>
        </div>
      </aside>

      {/* Main Content - With left margin for sidebar */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-950 to-gray-950">
        {/* Topbar - Fixed */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 lg:px-8 backdrop-blur-sm bg-gray-950/80 flex-shrink-0">
          <button
            className="lg:hidden text-gray-400 hover:text-white p-3 -m-1 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/5 rounded-lg transition-colors active:scale-95"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>

          <div className="flex-1 px-4 flex justify-end">
            {/* Placeholder for global search or notifications */}
            <div className="flex items-center gap-4">
              {/* Hide settings button when already on settings page */}
              {location.pathname !== '/dashboard/settings' && (
                <Link
                  to="/dashboard/settings"
                  aria-label="Settings"
                  className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Settings size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main id="main-content" className="flex-1 overflow-y-auto p-4 lg:p-8">
          <LazyPullToRefresh onRefresh={() => window.location.reload()}>
            <div className="max-w-6xl mx-auto min-h-[calc(100vh-8rem)] animate-fade-in">
              <Outlet />
            </div>
          </LazyPullToRefresh>
        </main>
      </div>

      {/* Global Modals */}
      {isCreateModalOpen && (
        <Suspense fallback={null}>
          <CreateLinkModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSuccess={handleLinkCreated}
          />
        </Suspense>
      )}

      {createdLink && (
        <Suspense fallback={null}>
          <LinkSuccessModal
            isOpen={!!createdLink}
            onClose={() => setCreatedLink(null)}
            linkData={createdLink}
          />
        </Suspense>
      )}
    </div>
  );
};

export default DashboardLayout;
