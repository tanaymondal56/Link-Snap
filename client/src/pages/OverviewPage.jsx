import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
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
  Info,
} from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import api from '../api/axios';
import { handleApiError } from '../utils/errorHandler';
import { getShortUrl } from '../utils/urlHelper';
const CreateLinkModal = lazy(() => import('../components/CreateLinkModal'));
import LinkSuccessModal from '../components/LinkSuccessModal';
import { useAuth } from '../context/AuthContext';
import BadgeTooltip from '../components/ui/BadgeTooltip';
import { getTierConfig } from '../config/subscriptionTiers';
import { getEffectiveTier } from '../utils/subscriptionUtils';

const OverviewPage = () => {
  const { user, isAuthChecking } = useAuth();
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

  const fetchOverviewData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    // Only fetch data when user is authenticated AND auth check is complete
    // This prevents race condition where cached user exists but token isn't refreshed yet
    if (user && !isAuthChecking) {
      fetchOverviewData();
    }
  }, [user, isAuthChecking, fetchOverviewData]);

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
          className="flex items-center gap-2 text-white py-3 px-5 rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: `linear-gradient(to right, var(--accent-from), var(--accent-to))`,
            boxShadow: `0 4px 12px var(--cta-shadow)`,
          }}
        >
          <Plus size={18} />
          Create New Link
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Links */}
        <div className="p-6 rounded-2xl relative overflow-hidden group transition-colors duration-300" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity" style={{ color: 'var(--stat-icon-color)' }}>
            <LinkIcon size={64} />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--stat-icon-bg)' }}>
              <LinkIcon size={18} style={{ color: 'var(--stat-icon-color)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--subtext-color)' }}>Total Links</p>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--heading-color)' }}>{stats.totalLinks}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--subtext-color)' }}>+{stats.linksThisMonth} this month</p>
        </div>

        {/* Total Clicks */}
        <div className="p-6 rounded-2xl relative overflow-hidden group transition-colors duration-300" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity" style={{ color: 'var(--stat-icon-color)' }}>
            <MousePointerClick size={64} />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--stat-icon-bg)' }}>
              <MousePointerClick size={18} style={{ color: 'var(--stat-icon-color)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--subtext-color)' }}>Total Clicks</p>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--heading-color)' }}>{stats.totalClicks}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--subtext-color)' }}>+{stats.clicksThisMonth} this month</p>
        </div>

        {/* Avg Clicks per Link */}
        <div className="p-6 rounded-2xl relative overflow-hidden group transition-colors duration-300" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity" style={{ color: 'var(--stat-icon-color)' }}>
            <TrendingUp size={64} />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--stat-icon-bg)' }}>
              <TrendingUp size={18} style={{ color: 'var(--stat-icon-color)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--subtext-color)' }}>Avg. Clicks</p>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--heading-color)' }}>
            {stats.totalLinks > 0 ? (stats.totalClicks / stats.totalLinks).toFixed(1) : '0'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--subtext-color)' }}>per link</p>
        </div>

        {/* Activity */}
        <div className="p-6 rounded-2xl relative overflow-hidden group transition-colors duration-300" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity" style={{ color: 'var(--stat-icon-color)' }}>
            <Activity size={64} />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--stat-icon-bg)' }}>
              <Activity size={18} style={{ color: 'var(--stat-icon-color)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--subtext-color)' }}>This Month</p>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--heading-color)' }}>{stats.linksThisMonth}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--subtext-color)' }}>links created</p>
        </div>
      </div>

      {/* Subscription Usage Card */}
      <div className="p-6 rounded-2xl transition-colors duration-300" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--stat-icon-bg)' }}>
              <Crown size={18} style={{ color: 'var(--stat-icon-color)' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold capitalize" style={{ color: 'var(--heading-color)' }}>
                {getEffectiveTier(user) === 'master' ? 'Master' : getEffectiveTier(user).charAt(0).toUpperCase() + getEffectiveTier(user).slice(1)} Plan
              </h2>
              <p className="text-sm" style={{ color: 'var(--subtext-color)' }}>Monthly usage limits</p>
            </div>
          </div>
          {getEffectiveTier(user) === 'free' && (
            <Link
              to="/pricing"
              className="flex items-center gap-2 px-4 py-2 text-white rounded-xl font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: `linear-gradient(to right, var(--accent-from), var(--accent-to))` }}
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
              <span className="text-sm flex items-center gap-2" style={{ color: 'var(--subtext-color)' }}>
                <LinkIcon size={14} />
                Links Created
                <BadgeTooltip content="Links currently active in your account. Delete links to free up space.">
                  <Info size={18} style={{ color: 'var(--stat-icon-color)' }} className="opacity-70 hover:opacity-100 transition-opacity" />
                </BadgeTooltip>
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--heading-color)' }}>
                {user?.linkUsage?.count || 0} /{' '}
                  {getTierConfig(getEffectiveTier(user)).activeLimit === Infinity
                    ? '∞'
                    : getTierConfig(getEffectiveTier(user)).activeLimit.toLocaleString()}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--divider-color)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  background: ((user?.linkUsage?.count || 0) / (getTierConfig(getEffectiveTier(user)).activeLimit === Infinity ? Infinity : getTierConfig(getEffectiveTier(user)).activeLimit)) >= 0.8
                    ? 'linear-gradient(to right, #f59e0b, #ef4444)'
                    : 'linear-gradient(to right, var(--progress-from), var(--progress-to))',
                  width: `${getTierConfig(getEffectiveTier(user)).activeLimit === Infinity ? 5 : Math.min(100, ((user?.linkUsage?.count || 0) / getTierConfig(getEffectiveTier(user)).activeLimit) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Monthly Created (Hard Limit) */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm flex items-center gap-2" style={{ color: 'var(--subtext-color)' }}>
                <Calendar size={14} />
                Monthly Created
                <BadgeTooltip content="Total links created this month. Resets on the 1st of each month.">
                  <Info
                    size={18}
                    style={{ color: 'var(--stat-icon-color)' }}
                    className="opacity-70 hover:opacity-100 transition-opacity"
                  />
                </BadgeTooltip>
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--heading-color)' }}>
                {user?.linkUsage?.hardCount || 0} /{' '}
                {getTierConfig(getEffectiveTier(user)).monthlyLimit.toLocaleString()}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--divider-color)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  background: ((user?.linkUsage?.hardCount || 0) / getTierConfig(getEffectiveTier(user)).monthlyLimit) >= 0.8
                    ? 'linear-gradient(to right, #f59e0b, #ef4444)'
                    : 'linear-gradient(to right, var(--progress-from), var(--progress-to))',
                  width: `${Math.min(100, ((user?.linkUsage?.hardCount || 0) / getTierConfig(getEffectiveTier(user)).monthlyLimit) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Warning for high usage */}
        {((user?.linkUsage?.count || 0) / (getTierConfig(getEffectiveTier(user)).activeLimit === Infinity ? Infinity : getTierConfig(getEffectiveTier(user)).activeLimit) >= 0.8 ||
          (user?.linkUsage?.hardCount || 0) / getTierConfig(getEffectiveTier(user)).monthlyLimit >= 0.8) && (
          <div className="mt-4 p-3 rounded-lg border" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
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
        <div className="rounded-2xl overflow-hidden transition-colors duration-300" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
          <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--divider-color)' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--stat-icon-bg)' }}>
                <Clock size={18} style={{ color: 'var(--stat-icon-color)' }} />
              </div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--heading-color)' }}>Recent Links</h2>
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
                      <span className="text-xs text-gray-500">{formatDate(link.createdAt)}</span>
                      <a
                        href={getShortUrl(link.customAlias || link.shortId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${link.customAlias || link.shortId} in new tab`}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <ExternalLink size={14} className="text-gray-400" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Performing Links */}
        <div className="rounded-2xl overflow-hidden transition-colors duration-300" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
          <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--divider-color)' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--stat-icon-bg)' }}>
                <TrendingUp size={18} style={{ color: 'var(--stat-icon-color)' }} />
              </div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--heading-color)' }}>Top Performers</h2>
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
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--stat-icon-bg)' }}>
                      <BarChart2 size={14} style={{ color: 'var(--stat-icon-color)' }} />
                      <span className="font-semibold text-sm" style={{ color: 'var(--stat-icon-color)' }}>{link.clicks}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="rounded-2xl p-6 transition-colors duration-300" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--heading-color)' }}>💡 Quick Tips</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl transition-colors duration-300" style={{ backgroundColor: 'var(--stat-icon-bg)', border: '1px solid var(--glass-border)' }}>
            <h3 className="font-medium mb-1" style={{ color: 'var(--heading-color)' }}>Custom Aliases</h3>
            <p className="text-sm" style={{ color: 'var(--subtext-color)' }}>
              Use memorable custom aliases for branded links that are easy to share.
            </p>
          </div>
          <div className="p-4 rounded-xl transition-colors duration-300" style={{ backgroundColor: 'var(--stat-icon-bg)', border: '1px solid var(--glass-border)' }}>
            <h3 className="font-medium mb-1" style={{ color: 'var(--heading-color)' }}>Track Performance</h3>
            <p className="text-sm" style={{ color: 'var(--subtext-color)' }}>
              Check analytics to see which links perform best and when.
            </p>
          </div>
          <div className="p-4 rounded-xl transition-colors duration-300" style={{ backgroundColor: 'var(--stat-icon-bg)', border: '1px solid var(--glass-border)' }}>
            <h3 className="font-medium mb-1" style={{ color: 'var(--heading-color)' }}>QR Codes</h3>
            <p className="text-sm" style={{ color: 'var(--subtext-color)' }}>
              Download QR codes for your links to use in print materials.
            </p>
          </div>
        </div>
      </div>

      {/* Create Link Modal */}
      {isCreateModalOpen && (
        <Suspense fallback={null}>
          <CreateLinkModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSuccess={handleLinkCreated}
          />
        </Suspense>
      )}

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
