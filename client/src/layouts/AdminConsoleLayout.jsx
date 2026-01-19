import { Outlet, Navigate, Link } from 'react-router-dom';
import AdminSidebar from '../components/admin-console/AdminSidebar';
import NotificationDropdown from '../components/admin-console/NotificationDropdown';
import { useAuth } from '../context/AuthContext';
import { Menu, Bell, User, LogOut, AlertTriangle, X, LayoutDashboard, Settings, ChevronDown, Shield } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import PullToRefresh from '../components/PullToRefresh';

const AdminConsoleLayout = () => {
  const { user, logout, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [profileOpen]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Admin Protection
  if (!user || !['admin', 'master_admin'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  const getRoleBadge = () => {
    if (user.role === 'master_admin') {
      return (
        <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-gradient-to-r from-red-500/20 to-orange-500/20 text-orange-400 border border-orange-500/30">
          MASTER
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
        ADMIN
      </span>
    );
  };

  return (
    <div className={`min-h-screen relative font-sans text-gray-100 overflow-x-hidden ${user.role === 'master_admin' ? 'master-theme' : ''}`}>
      {/* Mesh Gradient Background Layer */}
      <div className="mesh-gradient-bg">
        <div className="mesh-orb orb-1"></div>
        <div className="mesh-orb orb-2"></div>
        <div className="mesh-orb orb-3"></div>
      </div>

      {/* Floating Sidebar (Desktop & Mobile Drawer) */}
      <AdminSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-gray-950/90 backdrop-blur-xl border-b border-white/5 z-40 px-4 flex items-center justify-between">
        <span className="font-bold text-lg">LinkSnap Admin</span>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-3 -m-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white/10 active:scale-95 transition-transform"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Main Content Area */}
      <main className="lg:pl-[300px] min-h-screen pt-28 px-4 pb-20 lg:p-6 lg:pt-8 transition-all duration-300">
        
        {/* Top Bar */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Page Title Area (left empty for page-specific content) */}
          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-3 self-end md:self-auto">
            {/* Notifications */}
            <NotificationDropdown />
            
            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 p-[1px] hover:shadow-lg hover:shadow-purple-500/20 transition-all"
              >
                <div className="h-full px-3 rounded-[11px] bg-gray-900 flex items-center gap-2 overflow-hidden">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-xs font-bold text-white">
                    {user.firstName ? user.firstName[0].toUpperCase() : user.email[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-white hidden sm:block">
                    {user.firstName || user.email.split('@')[0]}
                  </span>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Dropdown Menu */}
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                  {/* User Info Header */}
                  <div className="p-4 border-b border-white/5 bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg font-bold text-white">
                        {user.firstName ? user.firstName[0].toUpperCase() : user.email[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white truncate">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                        <div className="mt-1 flex items-center gap-2">
                          {getRoleBadge()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="p-2">
                    <Link
                      to="/dashboard"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <LayoutDashboard size={18} />
                      <span className="text-sm">User Dashboard</span>
                    </Link>
                    <Link
                      to="/admin-console/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Settings size={18} />
                      <span className="text-sm">Console Settings</span>
                    </Link>
                  </div>

                  {/* Session Info & Logout */}
                  <div className="p-2 border-t border-white/5">
                    <div className="px-3 py-2 text-xs text-gray-500 flex items-center gap-2">
                      <Shield size={12} />
                      <span>Admin session active</span>
                    </div>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut size={18} />
                      <span className="text-sm font-medium">Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Master Admin Warning Banner (Sleek & Dismissible) */}
        {user.role === 'master_admin' && showBanner && (
          <div className="mb-6 relative group animate-in slide-in-from-top-4 fade-in duration-700">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-orange-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
            <div className="relative flex items-center justify-between p-4 rounded-xl bg-gray-950/50 backdrop-blur-md border border-red-500/20 shadow-xl">
               <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 text-red-400">
                     <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-400">
                      Master Admin Active
                    </h3>
                    <p className="text-sm text-gray-400">
                      System recovery mode enabled. Changes are permanent.
                    </p>
                  </div>
               </div>
               <button 
                  onClick={() => setShowBanner(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X size={18} />
               </button>
            </div>
          </div>
        )}

        {/* Page Content */}
        <PullToRefresh onRefresh={() => window.location.reload()}>
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </PullToRefresh>

      </main>
    </div>
  );
};

export default AdminConsoleLayout;

