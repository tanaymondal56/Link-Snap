import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Link as LinkIcon,
  BarChart2,
  Plus,
  TrendingUp,
  Clock,
  ExternalLink,
  Sparkles,
  ArrowRight,
  MousePointerClick,
  Calendar,
  Activity,
  Crown,
  AlertTriangle,
} from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import api from '../api/axios';
import { handleApiError } from '../utils/errorHandler';
import { getShortUrl } from '../utils/urlHelper';
import CreateLinkModal from '../components/CreateLinkModal';
import LinkSuccessModal from '../components/LinkSuccessModal';
import { useAuth } from '../context/AuthContext';

const OverviewPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalLinks: 0,
    totalClicks: 0,
    linksThisMonth: 0,
    clicksThisMonth: 0,
  });
  const [recentLinks, setRecentLinks] = useState([]);
  const [topLinks, setTopLinks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createdLink, setCreatedLink] = useState(null);

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    try {
      const { data } = await api.get('/url/my-links');
      const links = data.urls || [];

      // Calculate stats
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const totalClicks = links.reduce((acc, link) => acc + link.clicks, 0);
      const linksThisMonth = links.filter(
        (link) => new Date(link.createdAt) >= startOfMonth
      ).length;

      // For clicks this month, we'd need analytics data - for now estimate
      const clicksThisMonth = links
        .filter((link) => new Date(link.createdAt) >= startOfMonth)
        .reduce((acc, link) => acc + link.clicks, 0);

      setStats({
        totalLinks: links.length,
        totalClicks,
        linksThisMonth,
        clicksThisMonth,
      });

      // Get 5 most recent links
      const sorted = [...links].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRecentLinks(sorted.slice(0, 5));

      // Get top 5 by clicks
      const topByClicks = [...links].sort((a, b) => b.clicks - a.clicks);
      setTopLinks(topByClicks.slice(0, 5));
    } catch (error) {
      console.error(error);
      handleApiError(error, 'Failed to load overview data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkCreated = (newLink) => {
    setCreatedLink(newLink);
    fetchOverviewData(); // Refresh stats
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
          <p className="text-gray-400 mt-1">Here&apos;s a quick look at your link performance</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-3 px-5 rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
        >
          <Plus size={18} />
          Create New Link
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Links */}
        <div className="glass-dark p-6 rounded-2xl border border-blue-500/20 relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <LinkIcon size={64} />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <LinkIcon size={18} className="text-blue-400" />
            </div>
            <p className="text-gray-400 text-sm font-medium">Total Links</p>
          </div>
          <h3 className="text-3xl font-bold text-white">{stats.totalLinks}</h3>
          <p className="text-xs text-gray-500 mt-1">+{stats.linksThisMonth} this month</p>
        </div>

        {/* Total Clicks */}
        <div className="glass-dark p-6 rounded-2xl border border-purple-500/20 relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <MousePointerClick size={64} />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <MousePointerClick size={18} className="text-purple-400" />
            </div>
            <p className="text-gray-400 text-sm font-medium">Total Clicks</p>
          </div>
          <h3 className="text-3xl font-bold text-white">{stats.totalClicks}</h3>
          <p className="text-xs text-gray-500 mt-1">+{stats.clicksThisMonth} this month</p>
        </div>

        {/* Avg Clicks per Link */}
        <div className="glass-dark p-6 rounded-2xl border border-green-500/20 relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={64} />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp size={18} className="text-green-400" />
            </div>
            <p className="text-gray-400 text-sm font-medium">Avg. Clicks</p>
          </div>
          <h3 className="text-3xl font-bold text-white">
            {stats.totalLinks > 0 ? (stats.totalClicks / stats.totalLinks).toFixed(1) : '0'}
          </h3>
          <p className="text-xs text-gray-500 mt-1">per link</p>
        </div>

        {/* Activity */}
        <div className="glass-dark p-6 rounded-2xl border border-orange-500/20 relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity size={64} />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Activity size={18} className="text-orange-400" />
            </div>
            <p className="text-gray-400 text-sm font-medium">This Month</p>
          </div>
          <h3 className="text-3xl font-bold text-white">{stats.linksThisMonth}</h3>
          <p className="text-xs text-gray-500 mt-1">links created</p>
        </div>
      </div>

      {/* Subscription Usage Card */}
      <div className="glass-dark p-6 rounded-2xl border border-amber-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Crown size={18} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white capitalize">
                {user?.subscription?.tier || 'Free'} Plan
              </h3>
              <p className="text-gray-400 text-sm">Monthly usage limits</p>
            </div>
          </div>
          {(user?.subscription?.tier === 'free' || !user?.subscription?.tier) && (
            <Link
              to="/pricing"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl font-medium text-sm transition-all"
            >
              <Sparkles size={14} />
              Upgrade
            </Link>
          )}
        </div>
        
        {/* Usage Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Links Usage */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm flex items-center gap-2">
                <LinkIcon size={14} />
                Links Created
              </span>
              <span className="text-white text-sm font-medium">
                {user?.linkUsage?.count || 0} / {user?.subscription?.tier === 'pro' ? 500 : user?.subscription?.tier === 'business' ? '10,000' : 25}
              </span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  (user?.linkUsage?.count || 0) / (user?.subscription?.tier === 'pro' ? 500 : 25) >= 0.8 
                    ? 'bg-gradient-to-r from-orange-500 to-red-500' 
                    : 'bg-gradient-to-r from-blue-500 to-purple-500'
                }`}
                style={{ width: `${Math.min(100, ((user?.linkUsage?.count || 0) / (user?.subscription?.tier === 'pro' ? 500 : 25)) * 100)}%` }}
              />
            </div>
          </div>
          
          {/* Monthly Created (Hard Limit) */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm flex items-center gap-2">
                <Calendar size={14} />
                Monthly Created
              </span>
              <span className="text-white text-sm font-medium">
                {user?.linkUsage?.hardCount || 0} / {user?.subscription?.tier === 'pro' ? '2,000' : user?.subscription?.tier === 'business' ? '10,000' : 100}
              </span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  (user?.linkUsage?.hardCount || 0) / (user?.subscription?.tier === 'pro' ? 2000 : user?.subscription?.tier === 'business' ? 10000 : 100) >= 0.8 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500' 
                    : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                }`}
                style={{ width: `${Math.min(100, ((user?.linkUsage?.hardCount || 0) / (user?.subscription?.tier === 'pro' ? 2000 : user?.subscription?.tier === 'business' ? 10000 : 100)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
        
        {/* Warning for high usage */}
        {(user?.linkUsage?.count || 0) / (user?.subscription?.tier === 'pro' ? 500 : user?.subscription?.tier === 'business' ? 10000 : 25) >= 0.8 && (
          <div className="mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <p className="text-amber-300 text-sm flex items-center gap-2">
              <AlertTriangle size={14} />
              You're approaching your link limit. Consider upgrading for more capacity.
            </p>
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Links */}
        <div className="glass-dark rounded-2xl border border-gray-700/50 overflow-hidden">
          <div className="p-5 border-b border-gray-700/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Clock size={18} className="text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Recent Links</h3>
            </div>
            <Link
              to="/dashboard/links"
              className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-gray-700/50">
            {recentLinks.length === 0 ? (
              <div className="p-8 text-center">
                <LinkIcon size={32} className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400">No links yet</p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-3 text-sm text-blue-400 hover:text-blue-300"
                >
                  Create your first link
                </button>
              </div>
            ) : (
              recentLinks.map((link) => (
                <div key={link._id} className="p-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{link.title || 'Untitled'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {link.customAlias ? (
                          <span className="text-purple-400 text-sm font-mono flex items-center gap-1">
                            <Sparkles size={12} />/{link.customAlias}
                          </span>
                        ) : (
                          <span className="text-blue-400 text-sm font-mono">/{link.shortId}</span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mt-1 truncate">→ {link.originalUrl}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-500">
                        {formatDate(link.createdAt)}
                      </span>
                      <a
                        href={getShortUrl(link.customAlias || link.shortId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <ExternalLink size={14} className="text-gray-400" />
                      </a>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Performing Links */}
        <div className="glass-dark rounded-2xl border border-gray-700/50 overflow-hidden">
          <div className="p-5 border-b border-gray-700/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <TrendingUp size={18} className="text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Top Performers</h3>
            </div>
            <Link
              to="/dashboard/analytics"
              className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              Analytics <ArrowRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-gray-700/50">
            {topLinks.length === 0 ? (
              <div className="p-8 text-center">
                <BarChart2 size={32} className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400">No data yet</p>
                <p className="text-sm text-gray-500 mt-1">Create links to see performance</p>
              </div>
            ) : (
              topLinks.map((link, index) => (
                <div key={link._id} className="p-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : index === 1
                            ? 'bg-gray-400/20 text-gray-400'
                            : index === 2
                              ? 'bg-orange-600/20 text-orange-500'
                              : 'bg-gray-700 text-gray-500'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{link.title || 'Untitled'}</p>
                      <span className="text-gray-500 text-xs font-mono">
                        /{link.customAlias || link.shortId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 bg-purple-500/10 px-3 py-1.5 rounded-lg">
                      <BarChart2 size={14} className="text-purple-400" />
                      <span className="text-purple-400 font-semibold text-sm">{link.clicks}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="glass-dark rounded-2xl border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">💡 Quick Tips</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
            <h4 className="text-blue-400 font-medium mb-1">Custom Aliases</h4>
            <p className="text-gray-400 text-sm">
              Use memorable custom aliases for branded links that are easy to share.
            </p>
          </div>
          <div className="p-4 bg-purple-500/5 rounded-xl border border-purple-500/20">
            <h4 className="text-purple-400 font-medium mb-1">Track Performance</h4>
            <p className="text-gray-400 text-sm">
              Check analytics to see which links perform best and when.
            </p>
          </div>
          <div className="p-4 bg-green-500/5 rounded-xl border border-green-500/20">
            <h4 className="text-green-400 font-medium mb-1">QR Codes</h4>
            <p className="text-gray-400 text-sm">
              Download QR codes for your links to use in print materials.
            </p>
          </div>
        </div>
      </div>

      {/* Create Link Modal */}
      <CreateLinkModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleLinkCreated}
      />

      {/* Link Success Modal */}
      <LinkSuccessModal
        isOpen={!!createdLink}
        onClose={() => setCreatedLink(null)}
        linkData={createdLink}
      />
    </div>
  );
};

export default OverviewPage;
