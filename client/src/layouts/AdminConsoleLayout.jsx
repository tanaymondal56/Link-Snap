import { Outlet, Navigate } from 'react-router-dom';
import AdminSidebar from '../components/admin-console/AdminSidebar';
import { useAuth } from '../context/AuthContext';
import { Menu, Bell, User, LogOut, AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import PullToRefresh from '../components/PullToRefresh';

const AdminConsoleLayout = () => {
  const { user, logout, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

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
          className="p-2 rounded-lg bg-white/10"
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
            <button className="p-2.5 rounded-xl bg-gray-900/40 border border-white/5 hover:bg-white/5 text-gray-400 hover:text-white transition-all">
              <Bell size={18} />
            </button>
            <button
              onClick={logout}
              className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 p-[1px]">
              <div className="h-full w-full rounded-[11px] bg-gray-900 flex items-center justify-center overflow-hidden">
                 {/* Fallback avatar */}
                <User size={20} className="text-gray-400" />
              </div>
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
