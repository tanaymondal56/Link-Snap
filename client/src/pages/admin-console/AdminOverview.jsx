import { useEffect, useState } from 'react';
import { 
  Users, 
  Link as LinkIcon, 
  MousePointerClick, 
  Activity, 
  Server, 
  ShieldCheck, 
  Clock,
  Zap
} from 'lucide-react';
import BentoCard from '../../components/admin-console/ui/BentoCard';
import api from '../../api/axios';
import { formatDate } from '../../utils/dateUtils';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

const AdminOverview = () => {
  const { isAuthChecking } = useAuth();
  const [stats, setStats] = useState({ totalUsers: 0, totalUrls: 0, totalClicks: 0 });
  const [health, setHealth] = useState({ status: 'loading', uptime: 0 });
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth check to complete (ensure token is ready)
    if (isAuthChecking) return;

    const fetchData = async () => {
      try {
        const [statsRes, usersRes, healthRes] = await Promise.all([
          api.get('/admin/stats'),
          api.get('/admin/users'),
          api.get('/health')
        ]);
        
        setStats(statsRes.data);
        // Handle both paginated { users: [...] } and legacy array response
        const usersData = usersRes.data.users || usersRes.data;
        const sortedUsers = usersData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setRecentUsers(sortedUsers.slice(0, 5));
        setHealth(healthRes.data);
      } catch (error) {
        console.error('Failed to load overview data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthChecking]);

  // Helper to format uptime in seconds to readable format
  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const getSystemStatus = () => {
    if (health.status === 'ok') return { label: 'Operational', color: 'text-green-400', bg: 'bg-green-500' };
    if (health.status === 'loading') return { label: 'Checking...', color: 'text-gray-400', bg: 'bg-gray-500' };
    return { label: 'Issues Detected', color: 'text-red-400', bg: 'bg-red-500' };
  };

  const status = getSystemStatus();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Overview
          </h1>
          <p className="text-gray-400 mt-1">System performance and key metrics</p>
        </div>
        <div className={`px-3 py-1.5 rounded-full bg-white/5 border border-white/10 flex items-center gap-2`}>
          <div className={`w-2 h-2 rounded-full ${status.bg} animate-pulse`} />
          <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <BentoCard 
          colSpan={2} 
          variant="gradient"
          className="relative min-h-[200px] justify-center"
        >
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10" />
          <div className="flex items-center gap-6">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md shadow-2xl">
              <Server size={32} className="text-blue-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {health?.status === 'ok' ? 'System Healthy' : health?.status === 'loading' ? 'Checking...' : 'System Issues'}
              </h2>
              <div className="flex items-center gap-4 text-sm text-blue-200/70">
                <span className="flex items-center gap-1.5">
                  <Activity size={14} /> Uptime: {formatUptime(health?.uptime)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap size={14} /> {health.timestamp ? formatDate(health.timestamp) : 'Just Now'}
                </span>
              </div>
            </div>
          </div>
        </BentoCard>

        {/* Total Users */}
        <BentoCard title="Total Users" icon={Users} variant="default">
          <div className="mt-2">
            <h3 className="text-4xl font-bold text-white tracking-tight">{stats.totalUsers.toLocaleString()}</h3>
          </div>
        </BentoCard>

        {/* Total Links */}
        <BentoCard title="Active Links" icon={LinkIcon} variant="purple">
          <div className="mt-2">
            <h3 className="text-4xl font-bold text-white tracking-tight">{stats.totalUrls.toLocaleString()}</h3>
          </div>
        </BentoCard>

        {/* Total Clicks */}
        <BentoCard title="Total Clicks" icon={MousePointerClick} variant="default">
          <div className="mt-2">
            <h3 className="text-4xl font-bold text-white tracking-tight">{stats.totalClicks?.toLocaleString() || 0}</h3>
          </div>
        </BentoCard>

        {/* New Users (Wide) */}
        <BentoCard 
          colSpan={2} 
          title="Recent Users" 
          icon={Clock}
          className="min-h-[300px]"
        >
          <div className="mt-2 space-y-1">
            {recentUsers.length > 0 ? (
              recentUsers.map(user => (
                <div key={user._id} className="group flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors cursor-default">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-xs font-medium text-white">
                      {user.firstName ? user.firstName[0] : user.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">
                    {user.firstName || user.lastName ? (
                      <>
                        {user.firstName} {user.lastName} 
                        {user.username && <span className="text-purple-400 font-normal ml-2 text-xs">@{user.username}</span>}
                      </>
                    ) : user.username ? (
                      <span className="text-purple-400">@{user.username}</span>
                    ) : (
                      <span>{user.email}</span>
                    )}
                      </p>
                      {(user.firstName || user.lastName || user.username) && (
                        <p className="text-xs text-gray-500">{user.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded textxs font-medium ${
                      user.role === 'admin' 
                        ? 'bg-purple-500/20 text-purple-300' 
                        : 'bg-blue-500/20 text-blue-300'
                    } text-[10px] uppercase tracking-wider`}>
                      {user.role}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(user.createdAt)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-gray-500">No recent users found</div>
            )}
            
            <Link 
              to="/admin-console/users"
              className="block text-center py-3 text-sm text-gray-400 hover:text-white transition-colors border-t border-white/5 mt-4"
            >
              View All Users
            </Link>
          </div>
        </BentoCard>



        {/* Quick Actions */}
        <BentoCard title="Quick Actions" icon={Zap}>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <Link to="/admin-console/users" className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 text-left transition-all group block">
              <ShieldCheck size={20} className="mb-2 text-blue-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium text-gray-300 block">Manage Users</span>
            </Link>
            <Link to="/admin-console/monitoring" className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 text-left transition-all group block">
              <Server size={20} className="mb-2 text-purple-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium text-gray-300 block">Server Logs</span>
            </Link>
          </div>
        </BentoCard>
      </div>
    </div>
  );
};

export default AdminOverview;
