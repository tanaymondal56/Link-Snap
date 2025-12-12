import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Link as LinkIcon,
  Settings,
  FileText,
  LogOut,
  Sparkles,
  ChevronLeft,
  Activity,
  MessageSquare
} from 'lucide-react';

const AdminSidebar = ({ isOpen, onClose }) => {
  const navItems = [
    { path: '/admin-console/overview', icon: LayoutDashboard, label: 'Overview' },
    { path: '/admin-console/monitoring', icon: Activity, label: 'Monitoring' },
    { path: '/admin-console/users', icon: Users, label: 'Users' },
    { path: '/admin-console/links', icon: LinkIcon, label: 'Links' },
    { path: '/admin-console/feedback', icon: MessageSquare, label: 'Feedback' },
    { path: '/admin-console/changelog', icon: FileText, label: 'Changelog' },
    { path: '/admin-console/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 z-[60] lg:hidden transition-opacity duration-300 ${
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <aside 
        className={`
            fixed top-6 bottom-6 lg:left-6 z-[70] w-64 flex flex-col transition-all duration-300 ease-in-out
            ${isOpen ? 'left-6' : '-left-80 lg:left-6'}
        `}
      >
      {/* Glass Dock Container */}
      <div className="glass-dock h-full rounded-3xl flex flex-col p-4 shadow-2xl shadow-blue-900/10">
        
        {/* Brand */}
        <div className="px-4 py-4 mb-6 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            LinkSnap
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group
                ${isActive 
                  ? 'bg-white/10 text-white shadow-lg border border-white/10 scale-[1.02]' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'}
              `}
            >
              {({ isActive }) => (
                <>
                  <item.icon 
                    size={20} 
                    className={`transition-colors duration-300 ${isActive ? 'text-blue-400' : 'group-hover:text-blue-300'}`} 
                  />
                  <span className="font-medium">{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)]" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer Actions */}
        <div className="mt-auto pt-6 border-t border-white/5 space-y-2">
          <NavLink
            to="/dashboard"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all"
          >
            <ChevronLeft size={20} />
            <span className="font-medium">Back to App</span>
          </NavLink>
        </div>
      </div>
    </aside>
    </>
  );
};

export default AdminSidebar;
