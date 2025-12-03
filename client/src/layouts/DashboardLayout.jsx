import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { cn } from '../utils/cn';

import { Loader2 } from 'lucide-react';

const DashboardLayout = () => {
  const { user, logout, loading, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Redirect to home if not logged in (don't force auth modal)
  useEffect(() => {
    if (!loading && !user) {
      navigate('/', { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading)
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
          'fixed inset-y-0 left-0 z-50 w-64 bg-gray-900/95 backdrop-blur-xl border-r border-white/5 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl lg:shadow-none',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
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
          <Link
            to="/"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-3 px-4 rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <LinkIcon size={18} />
            <span>New Link</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
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
                {item.name}
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
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content - With left margin for sidebar */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-gray-950 to-gray-950">
        {/* Topbar - Fixed */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 lg:px-8 backdrop-blur-sm bg-gray-950/80 flex-shrink-0">
          <button
            className="lg:hidden text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-lg transition-colors"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>

          <div className="flex-1 px-4 flex justify-end">
            {/* Placeholder for global search or notifications */}
            <div className="flex items-center gap-4">
              <Link
                to="/dashboard/settings"
                className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Settings size={16} />
              </Link>
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
