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
import { getEffectiveTier } from '../utils/subscriptionUtils';
import { applyTierTheme, TIER_BADGES } from '../utils/tierTheme';

import { Loader2 } from 'lucide-react';

import LazyPullToRefresh from '../components/LazyPullToRefresh';
import OfflineIndicator from '../components/OfflineIndicator';
const CreateLinkModal = lazy(() => import('../components/CreateLinkModal'));
const LinkSuccessModal = lazy(() => import('../components/LinkSuccessModal'));

const DashboardLayout = () => {
  const { user, logout, loading, isAuthChecking, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [createdLink, setCreatedLink] = useState(null);
  const adminTriggerTimer = useRef(null); // For hidden admin recovery trigger
  const prevTierRef = useRef(null); // Track previous tier for upgrade celebration
  const userCardRef = useRef(null); // Ref for upgrade glow animation target

  // Set meta robots to noindex for dashboard pages (SEO)
  useEffect(() => {
    let metaRobots = document.querySelector('meta[name="robots"]');
    if (!metaRobots) {
      metaRobots = document.createElement('meta');
      metaRobots.name = 'robots';
      document.head.appendChild(metaRobots);
    }
    metaRobots.content = 'noindex, nofollow';

    return () => {
      // Reset to default when leaving dashboard
      metaRobots.content = 'index, follow';
    };
  }, []);

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
  // Don't redirect if there's a cached user being validated
  useEffect(() => {
    const hasCachedUser = localStorage.getItem('ls_auth_user');
    if (!loading && !user && !hasCachedUser) {
      navigate('/', { replace: true });
    }
  }, [loading, user, navigate]);

  // Check if user has Pro/Business tier
  const userTier = user?.role === 'master_admin' ? 'master' : getEffectiveTier(user);
  const tierBadge = TIER_BADGES[userTier] || null;

  // ─── Apply Tier Theme ───────────────────────────────────────────────────
  // Runs whenever user data changes. CSS @property transitions handle the
  // smooth color interpolation automatically — no JS animation needed.
  useEffect(() => {
    applyTierTheme(userTier);

    // Upgrade celebration: if tier increased, briefly glow the sidebar card
    const TIER_RANK = { free: 0, pro: 1, business: 2, master: 3 };
    if (prevTierRef.current !== null &&
        TIER_RANK[userTier] > TIER_RANK[prevTierRef.current] &&
        userCardRef.current) {
      userCardRef.current.classList.add('upgrade-celebrate');
      const timer = setTimeout(() => {
        userCardRef.current?.classList.remove('upgrade-celebrate');
      }, 2000);
      prevTierRef.current = userTier;
      return () => clearTimeout(timer);
    }
    prevTierRef.current = userTier;
  }, [userTier]);

  // Check if there's a cached user but user isn't set yet (still loading)
  // Or if we are currently running the background token validation
  const hasCachedUser = typeof window !== 'undefined' && localStorage.getItem('ls_auth_user');
  const isStillLoading = loading || isAuthChecking || (hasCachedUser && !user);

  if (isStillLoading)
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <Loader2 className="animate-spin h-10 w-10 text-blue-500" />
      </div>
    );

  // If user is null and not loading, the useEffect will redirect them. Avoid rendering layout.
  if (!user) return null; 

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

  // Add admin panel link for admin users
  if (isAdmin) {
    navigation.push({ name: 'Admin Panel', href: '/admin', icon: Shield, isAdmin: true });
  }

  return (
    <div className="h-screen bg-gray-950 text-white flex font-sans overflow-hidden" style={{ '--tw-selection': 'var(--selection)' }}>
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
          'fixed inset-y-0 left-0 z-50 w-64 backdrop-blur-xl flex flex-col shadow-2xl lg:shadow-none will-change-transform',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          'transition-transform duration-300 ease-out'
        )}
        style={{ borderRight: '1px solid var(--sidebar-border)', backgroundColor: 'var(--sidebar-bg)' }}
      >
        <div className="h-20 flex items-center px-6" style={{ borderBottom: '1px solid var(--divider-color)' }}>
          <Link to="/" className="flex items-center gap-3 group">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transition-all"
              style={{ background: `linear-gradient(to bottom right, var(--accent-from), var(--accent-to))`, boxShadow: `0 4px 12px var(--cta-shadow)` }}
            >
              <LinkIcon size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              LinkSnap
            </span>
          </Link>
          <button
            className="ml-auto lg:hidden text-gray-400 hover:text-white transition-colors"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar menu"
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
            className="w-full text-white py-3 px-4 rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(to right, var(--accent-from), var(--accent-to))`,
              boxShadow: `0 4px 12px var(--cta-shadow)`,
            }}
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
                      : 'shadow-inner border'
                    : item.isAdmin
                      ? 'text-amber-400/70 hover:bg-amber-500/10 hover:text-amber-300 hover:translate-x-1'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white hover:translate-x-1'
                )}
                style={isActive && !item.isAdmin ? {
                  backgroundColor: 'var(--nav-active-bg)',
                  color: 'var(--nav-active-text)',
                  borderColor: 'var(--card-border)',
                } : undefined}
              >
                <item.icon
                  size={20}
                  className={cn(
                    isActive
                      ? item.isAdmin
                        ? 'text-amber-400'
                        : ''
                      : item.isAdmin
                        ? 'text-amber-500/50'
                        : 'text-gray-500 group-hover:text-gray-300'
                  )}
                  style={isActive && !item.isAdmin ? { color: 'var(--nav-active-icon)' } : undefined}
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

        <div className="p-4 bg-black/20" style={{ borderTop: '1px solid var(--divider-color)' }}>
          <div
            ref={userCardRef}
            className="flex items-center gap-3 px-3 py-2 mb-3 rounded-lg bg-white/5"
            style={{ border: '1px solid var(--card-border)' }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shadow-inner"
              style={{ background: `linear-gradient(to bottom right, var(--avatar-from), var(--avatar-to))` }}
            >
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
              <p className="text-xs text-gray-400 capitalize flex items-center gap-1.5">
                {user.role}
                {tierBadge && (
                  <span className={`tier-badge ${tierBadge.className}`}>
                    {tierBadge.label}
                  </span>
                )}
              </p>
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
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64" style={{ background: `radial-gradient(ellipse at top right, var(--bg-radial), rgb(3,7,18) 50%, rgb(3,7,18))` }}>
        {/* Topbar - Fixed */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 backdrop-blur-sm flex-shrink-0 relative" style={{ borderBottom: '1px solid var(--sidebar-border)', backgroundColor: 'var(--topbar-bg)' }}>
          {/* Topbar accent line — changes color per tier */}
          <div className="topbar-accent-line" />
          <button
            className="lg:hidden text-gray-400 hover:text-white p-3 -m-1 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/5 rounded-lg transition-colors active:scale-95"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar menu"
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
