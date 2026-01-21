import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  ExternalLink,
  Trash2,
  Ban,
  CheckCircle,
  MoreHorizontal,
  BarChart2,
  UserX,
  Link as LinkIcon,
  MousePointerClick,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  ShieldOff,
  Lock,
  Smartphone,
  Calendar,
  Globe,
  Timer,
  Copy,
} from 'lucide-react';
import GlassTable from '../../components/admin-console/ui/GlassTable';
import api from '../../api/axios';
import { useConfirm } from '../../context/ConfirmContext';
import showToast from '../../utils/toastUtils';
import { Link } from 'react-router-dom';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { Loader2 } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';

const AdminLinks = () => {
  const { isAuthChecking } = useAuth();
  const confirm = useConfirm();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [safetyFilter, setSafetyFilter] = useState('all');
  const [rescanningId, setRescanningId] = useState(null);
  const [expandedLinkId, setExpandedLinkId] = useState(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLinks, setTotalLinks] = useState(0);

  const [openActionId, setOpenActionId] = useState(null);

  // Pull to refresh
  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/links', {
        params: {
          page,
          limit: 20,
          search: debouncedSearch,
          status: statusFilter,
          safety: safetyFilter,
        },
      });
      setLinks(data.urls);
      setTotalPages(data.pages);
      setTotalLinks(data.total);
    } catch (error) {
      console.error(error);
      showToast.error('Failed to load links');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, statusFilter, safetyFilter]);

  const isRefreshing = usePullToRefresh(async () => {
    // Silent refresh
    try {
      const { data } = await api.get(
        `/admin/links?search=${debouncedSearch}&status=${statusFilter}`
      );
      setLinks(data.urls);
      showToast.success('Refreshed');
    } catch {
      showToast.error('Failed to refresh');
    }
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 600);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    // Wait for auth check to complete (ensure token is ready)
    if (!isAuthChecking) {
      fetchLinks();
    }
  }, [fetchLinks, isAuthChecking]);

  const handleToggleStatus = async (link) => {
    setOpenActionId(null);
    try {
      await api.patch(`/admin/links/${link._id}/status`);
      setLinks(links.map((l) => (l._id === link._id ? { ...l, isActive: !l.isActive } : l)));
      showToast.success(`Link ${link.isActive ? 'disabled' : 'enabled'}`);
    } catch {
      showToast.error('Failed to update status');
    }
  };

  const handleDelete = async (linkId) => {
    setOpenActionId(null);
    const confirmed = await confirm({
      title: 'Delete Link?',
      message: 'This will permanently delete the link and its analytics.',
      confirmText: 'Delete Link',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.delete(`/admin/links/${linkId}`);

      // If this was the last item on the page and not the first page, go back
      if (links.length === 1 && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        setLinks(links.filter((l) => l._id !== linkId));
      }

      setTotalLinks((prev) => prev - 1);
      showToast.success('Link deleted');
    } catch {
      showToast.error('Failed to delete link');
    }
  };

  // Handle Re-scan single link
  const handleRescan = async (link) => {
    setOpenActionId(null);
    setRescanningId(link._id);
    try {
      const { data } = await api.post(`/admin/links/${link._id}/rescan`);
      setLinks(
        links.map((l) =>
          l._id === link._id
            ? { ...l, safetyStatus: data.url.safetyStatus, safetyDetails: data.url.safetyDetails }
            : l
        )
      );
      showToast.success(`Scan complete: ${data.url.safetyStatus}`);
    } catch {
      showToast.error('Failed to re-scan link');
    } finally {
      setRescanningId(null);
    }
  };

  // Handle Safety Override
  const handleSafetyOverride = async (link, newStatus) => {
    setOpenActionId(null);
    try {
      const { data } = await api.patch(`/admin/links/${link._id}/safety`, {
        safetyStatus: newStatus,
      });
      setLinks(
        links.map((l) =>
          l._id === link._id
            ? { ...l, safetyStatus: newStatus, safetyDetails: data.url.safetyDetails }
            : l
        )
      );
      showToast.success(`Safety status set to ${newStatus}`);
    } catch {
      showToast.error('Failed to override safety status');
    }
  };

  const handleCopy = (text, label = 'Text') => {
    navigator.clipboard.writeText(text);
    showToast.success(`${label} copied to clipboard`);
  };

  // Compute stats
  const stats = {
    total: totalLinks,
    active: links.filter((l) => l.isActive).length,
    disabled: links.filter((l) => !l.isActive).length,
    totalClicks: links.reduce((sum, l) => sum + (l.clicks || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Pull to Refresh Indicator */}
      {isRefreshing && (
        <div className="flex justify-center py-2 animate-fade-in">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Links
          </h1>
          <p className="text-gray-400 mt-1">Manage global short links</p>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <LinkIcon size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Links</p>
            <p className="text-lg font-bold text-white">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <CheckCircle size={18} className="text-green-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Active</p>
            <p className="text-lg font-bold text-white">{stats.active}</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Ban size={18} className="text-orange-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Disabled</p>
            <p className="text-lg font-bold text-white">{stats.disabled}</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <MousePointerClick size={18} className="text-purple-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Clicks</p>
            <p className="text-lg font-bold text-white">{stats.totalClicks.toLocaleString()}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 p-1 rounded-2xl">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Search by title, original URL, short ID, alias, or owner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900/40 backdrop-blur-md border border-white/5 rounded-xl text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-gray-600"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1); // Reset page on filter change
            }}
            className="pl-10 pr-8 py-2.5 bg-gray-900/40 backdrop-blur-md border border-white/5 rounded-xl text-sm focus:outline-none focus:border-blue-500/50 transition-all text-gray-300 appearance-none cursor-pointer hover:bg-white/5"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="expired">Expired</option>
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <ChevronLeft size={14} className="rotate-[-90deg] text-gray-500" />
          </div>
        </div>

        {/* Safety Filter */}
        <div className="relative">
          <ShieldCheck
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            size={16}
          />
          <select
            value={safetyFilter}
            onChange={(e) => {
              setSafetyFilter(e.target.value);
              setPage(1);
            }}
            className="pl-10 pr-8 py-2.5 bg-gray-900/40 backdrop-blur-md border border-white/5 rounded-xl text-sm focus:outline-none focus:border-blue-500/50 transition-all text-gray-300 appearance-none cursor-pointer hover:bg-white/5"
          >
            <option value="all">All Safety</option>
            <option value="safe">✅ Safe</option>
            <option value="malware">🔴 Malware</option>
            <option value="phishing">🔴 Phishing</option>
            <option value="pending">⏳ Pending</option>
            <option value="unchecked">❓ Unchecked</option>
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <ChevronLeft size={14} className="rotate-[-90deg] text-gray-500" />
          </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading links...</div>
        ) : links.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No links found</div>
        ) : (
          links.map((link) => (
            <div
              key={link._id}
              className={`bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 ${link.ownerBanned ? 'bg-orange-500/5' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-blue-400 text-lg">/{link.shortId}</span>
                  {link.customAlias && (
                    <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded-lg">
                      /{link.customAlias}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(link.createdAt).toLocaleDateString()}
                </div>
              </div>

              {/* Mobile Safety Badge */}
              <div className="flex items-center gap-2 mb-2">
                {link.safetyStatus === 'safe' && (
                  <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded border border-green-500/20">
                    Safe
                  </span>
                )}
                {(link.safetyStatus === 'malware' || link.safetyStatus === 'phishing') && (
                  <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 font-bold uppercase">
                    {link.safetyStatus}
                  </span>
                )}
              </div>

              <div className="text-sm text-gray-400 truncate border-l-2 border-white/10 pl-2">
                {link.originalUrl}
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">
                    By:{' '}
                    {link.createdBy?.username
                      ? `@${link.createdBy.username}`
                      : link.createdBy?.email || link.userId?.email || 'Anonymous'}
                  </span>
                  {link.ownerBanned && (
                    <span className="text-orange-400 flex items-center gap-1">
                      <UserX size={10} /> Banned
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                <div className="bg-black/20 rounded p-2 text-center">
                  <div className="text-xs text-gray-500">Clicks</div>
                  <div className="font-bold text-white">{link.clicks || 0}</div>
                </div>
                <div className="bg-black/20 rounded p-2 text-center">
                  <div className="text-xs text-gray-500">Status</div>
                  <div className="flex flex-col items-center justify-center min-h-[1.5rem]">
                    {!link.isActive ? (
                      <span className="text-red-400 font-bold">Disabled</span>
                    ) : link.ownerBanned ? (
                      <>
                        <span className="text-orange-400 font-bold text-sm leading-tight">
                          Owner Banned
                        </span>
                        <span
                          className={`text-[10px] ${!link.createdBy?.disableLinksOnBan ? 'text-green-400' : 'text-red-400'}`}
                        >
                          {!link.createdBy?.disableLinksOnBan ? '(Link Active)' : '(Link Disabled)'}
                        </span>
                      </>
                    ) : link.expiresAt && new Date(link.expiresAt) < new Date() ? (
                      <span className="text-amber-400 font-bold">Expired</span>
                    ) : (
                      <span className="text-green-400 font-bold">Active</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile Actions & Details */}
              <div className="pt-2 border-t border-white/5">
                <div className="flex gap-2">
                  <button
                    onClick={() => window.open(link.originalUrl, '_blank')}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-gray-300"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => setExpandedLinkId(expandedLinkId === link._id ? null : link._id)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                      expandedLinkId === link._id
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    {expandedLinkId === link._id ? 'Hide Details' : 'Details'}{' '}
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${expandedLinkId === link._id ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <button
                    onClick={() => handleDelete(link._id)}
                    className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-xs font-medium text-red-400"
                  >
                    Delete
                  </button>
                </div>

                {/* Mobile Expanded Details */}
                {expandedLinkId === link._id && (
                  <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1">
                    {/* Key Properties Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Password Status */}
                      <div className="bg-black/20 p-2 rounded">
                        <div className="text-gray-500 mb-0.5 flex items-center gap-1">
                          <Lock size={10} /> Password
                        </div>
                        <div
                          className={
                            link.password
                              ? 'text-purple-400 font-medium'
                              : link.isPasswordProtected
                                ? 'text-purple-400 font-medium'
                                : 'text-gray-600'
                          }
                        >
                          {link.password
                            ? '🔒 Protected'
                            : link.isPasswordProtected
                              ? '🔒 Protected'
                              : 'None'}
                        </div>
                      </div>

                      {/* Expiration */}
                      <div className="bg-black/20 p-2 rounded">
                        <div className="text-gray-500 mb-0.5 flex items-center gap-1">
                          <Timer size={10} /> Expires
                        </div>
                        <div
                          className={
                            link.expiresAt
                              ? new Date(link.expiresAt) < new Date()
                                ? 'text-red-400'
                                : 'text-amber-400'
                              : 'text-gray-600'
                          }
                        >
                          {link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : 'Never'}
                        </div>
                      </div>

                      {/* Scheduled Start */}
                      <div className="bg-black/20 p-2 rounded">
                        <div className="text-gray-500 mb-0.5 flex items-center gap-1">
                          <Calendar size={10} /> Scheduled
                        </div>
                        <div className={link.scheduledAt ? 'text-blue-400' : 'text-gray-600'}>
                          {link.scheduledAt
                            ? new Date(link.scheduledAt).toLocaleDateString()
                            : 'None'}
                        </div>
                      </div>

                      {/* Device Redirects Count */}
                      <div className="bg-black/20 p-2 rounded">
                        <div className="text-gray-500 mb-0.5 flex items-center gap-1">
                          <Smartphone size={10} /> Device Rules
                        </div>
                        <div
                          className={
                            link.deviceRedirects?.enabled
                              ? 'text-cyan-400 font-medium'
                              : 'text-gray-600'
                          }
                        >
                          {link.deviceRedirects?.enabled
                            ? `${link.deviceRedirects.rules?.length || 0} Rules`
                            : 'None'}
                        </div>
                      </div>

                      {/* Time Redirects Count */}
                      <div className="bg-black/20 p-2 rounded">
                        <div className="text-gray-500 mb-0.5 flex items-center gap-1">
                          <Clock size={10} /> Time Rules
                        </div>
                        <div
                          className={
                            link.timeRedirects?.enabled
                              ? 'text-indigo-400 font-medium'
                              : 'text-gray-600'
                          }
                        >
                          {link.timeRedirects?.enabled
                            ? `${link.timeRedirects.rules?.length || 0} Rules`
                            : 'None'}
                        </div>
                      </div>

                      {/* Safety Last Checked */}
                      <div className="bg-black/20 p-2 rounded">
                        <div className="text-gray-500 mb-0.5 flex items-center gap-1">
                          <ShieldCheck size={10} /> Last Scan
                        </div>
                        <div className="text-gray-400">
                          {link.lastCheckedAt
                            ? new Date(link.lastCheckedAt).toLocaleDateString()
                            : 'Never'}
                        </div>
                      </div>
                    </div>

                    {/* Device Rules Mobile */}
                    {link.deviceRedirects?.enabled && link.deviceRedirects.rules?.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Smartphone size={12} /> Device Rules ({link.deviceRedirects.rules.length}
                          )
                        </div>
                        {link.deviceRedirects.rules.map((rule, i) => (
                          <div
                            key={i}
                            className="bg-cyan-500/5 border border-cyan-500/10 rounded p-2 text-xs space-y-1"
                          >
                            <div className="flex justify-between items-center text-cyan-400 font-bold uppercase">
                              <span>{rule.device}</span>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleCopy(rule.url, 'URL')}
                                  aria-label="Copy URL"
                                  className="p-1 hover:bg-cyan-500/20 rounded"
                                >
                                  <Copy size={12} aria-hidden="true" />
                                </button>
                                <a
                                  href={rule.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label="Open URL in new tab"
                                  className="p-1 hover:bg-cyan-500/20 rounded"
                                >
                                  <ExternalLink size={12} aria-hidden="true" />
                                </a>
                              </div>
                            </div>
                            <div className="truncate text-gray-400">{rule.url}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Time Rules Mobile */}
                    {link.timeRedirects?.enabled && link.timeRedirects.rules?.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock size={12} /> Time Rules ({link.timeRedirects.rules.length})
                        </div>
                        {link.timeRedirects.rules.map((rule, i) => (
                          <div
                            key={i}
                            className="bg-indigo-500/5 border border-indigo-500/10 rounded p-2 text-xs space-y-1"
                          >
                            <div className="flex justify-between items-center text-indigo-400 font-bold">
                              <span>
                                {rule.startTime} - {rule.endTime}
                              </span>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleCopy(rule.destination, 'URL')}
                                  aria-label="Copy destination URL"
                                  className="p-1 hover:bg-indigo-500/20 rounded"
                                >
                                  <Copy size={12} aria-hidden="true" />
                                </button>
                                <a
                                  href={rule.destination}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label="Open destination in new tab"
                                  className="p-1 hover:bg-indigo-500/20 rounded"
                                >
                                  <ExternalLink size={12} aria-hidden="true" />
                                </a>
                              </div>
                            </div>
                            <div className="truncate text-gray-400">{rule.destination}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Manual Override Mobile Badge */}
                    {link.manualSafetyOverride && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2 text-xs text-amber-400 flex items-center gap-1">
                        ⚠️ Manually Overridden
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <GlassTable
          headers={[
            'Short Link',
            'Custom Alias',
            'Original URL',
            'Safety',
            'Owner',
            'Clicks',
            'Status',
            'Actions',
          ]}
        >
          {loading ? (
            <tr>
              <td colSpan="8" className="p-8 text-center text-gray-500">
                Loading links...
              </td>
            </tr>
          ) : links.length === 0 ? (
            <tr>
              <td colSpan="8" className="p-8 text-center text-gray-500">
                No links found
              </td>
            </tr>
          ) : (
            links.map((link) => {
              const isOwnerBanned = link.ownerBanned;
              const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
              return (
                <React.Fragment key={link._id}>
                  <tr
                    className={`hover:bg-white/5 transition-colors group ${isOwnerBanned ? 'bg-orange-500/5' : ''} ${expandedLinkId === link._id ? 'bg-white/[0.03]' : ''}`}
                  >
                    <td className="p-4 whitespace-nowrap w-[15%]">
                      <button
                        onClick={() =>
                          setExpandedLinkId(expandedLinkId === link._id ? null : link._id)
                        }
                        className="flex items-center gap-2 text-left hover:text-blue-300 transition-colors w-full"
                      >
                        <span
                          className={`transition-transform duration-200 ${expandedLinkId === link._id ? 'rotate-180' : ''}`}
                        >
                          <ChevronDown size={14} className="text-gray-500" />
                        </span>
                        <div className="flex flex-col">
                          <span className="font-mono text-blue-400">/{link.shortId}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(link.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </button>
                    </td>
                    <td className="p-4 whitespace-nowrap w-[10%]">
                      {link.customAlias ? (
                        <span className="font-mono text-purple-400">/{link.customAlias}</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="p-4 max-w-[300px] w-[30%]">
                      <div className="truncate text-gray-300" title={link.originalUrl}>
                        {link.originalUrl}
                      </div>
                    </td>
                    <td className="p-4">
                      {link.safetyStatus === 'safe' && (
                        <span className="text-green-400 text-xs flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded-full w-fit">
                          <CheckCircle size={10} /> Safe
                        </span>
                      )}
                      {link.safetyStatus === 'malware' && (
                        <span className="text-red-400 text-xs flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded-full w-fit">
                          <ShieldCheck size={10} /> Malware
                        </span>
                      )}
                      {link.safetyStatus === 'phishing' && (
                        <span className="text-red-400 text-xs flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded-full w-fit">
                          <ShieldCheck size={10} /> Phishing
                        </span>
                      )}
                      {(link.safetyStatus === 'pending' ||
                        link.safetyStatus === 'unknown' ||
                        !link.safetyStatus) && (
                        <span className="text-gray-500 text-xs flex items-center gap-1 bg-gray-500/10 px-2 py-1 rounded-full w-fit">
                          <Clock size={10} /> Pending
                        </span>
                      )}
                      {link.safetyStatus === 'unchecked' && (
                        <span className="text-gray-500 text-xs flex items-center gap-1 bg-gray-500/10 px-2 py-1 rounded-full w-fit">
                          -
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-xs">
                      <div className="flex flex-col gap-1">
                        {link.createdBy?.username && (
                          <span className="text-purple-400">@{link.createdBy.username}</span>
                        )}
                        <span className="text-gray-400">
                          {link.createdBy?.email || link.userId?.email || 'Anonymous'}
                        </span>
                        {link.ownerBanned && (
                          <span className="inline-flex items-center gap-1 text-orange-400">
                            <UserX size={10} /> Banned
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1.5 text-xs">
                        <BarChart2 size={12} /> {link.clicks || 0}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        {!link.isActive ? (
                          <span className="text-red-400 text-xs flex items-center gap-1 w-fit">
                            <Ban size={12} /> Disabled
                          </span>
                        ) : isOwnerBanned ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-orange-400 text-xs flex items-center gap-1 w-fit">
                              <UserX size={12} /> Owner Banned
                            </span>
                            {!link.createdBy?.disableLinksOnBan ? (
                              <span className="text-green-400 text-[10px] flex items-center gap-1 ml-4">
                                <CheckCircle size={10} /> Link Active
                              </span>
                            ) : (
                              <span className="text-red-400 text-[10px] flex items-center gap-1 ml-4">
                                <Ban size={10} /> Link Disabled
                              </span>
                            )}
                          </div>
                        ) : isExpired ? (
                          <span
                            className="text-amber-400 text-xs flex items-center gap-1 w-fit"
                            title={`Expired on ${new Date(link.expiresAt).toLocaleDateString()}`}
                          >
                            <Clock size={12} /> Expired
                          </span>
                        ) : (
                          <span className="text-green-400 text-xs flex items-center gap-1 w-fit">
                            <CheckCircle size={12} /> Active
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="relative">
                        <button
                          onClick={() =>
                            setOpenActionId(openActionId === link._id ? null : link._id)
                          }
                          className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                          <MoreHorizontal size={18} />
                        </button>

                        {/* Action Dropdown */}
                        {openActionId === link._id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenActionId(null)}
                            />
                            <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden animate-fade-in text-left">
                              <a
                                href={link.originalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 flex items-center gap-2 text-gray-300 hover:text-white"
                              >
                                <ExternalLink size={16} /> Visit Original
                              </a>
                              <a
                                href={`/dashboard/analytics/${link.customAlias || link.shortId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 flex items-center gap-2 text-gray-300 hover:text-white"
                              >
                                <BarChart2 size={16} /> View Analytics
                              </a>
                              <button
                                onClick={() => handleToggleStatus(link)}
                                className={`w-full text-left px-4 py-3 text-sm hover:bg-white/5 flex items-center gap-2 ${link.isActive ? 'text-orange-400' : 'text-green-400'}`}
                              >
                                {link.isActive ? <Ban size={16} /> : <CheckCircle size={16} />}
                                {link.isActive ? 'Disable Link' : 'Enable Link'}
                              </button>
                              {/* Re-Scan Button */}
                              <button
                                onClick={() => handleRescan(link)}
                                disabled={rescanningId === link._id}
                                className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 flex items-center gap-2 text-blue-400 disabled:opacity-50"
                              >
                                <RefreshCw
                                  size={16}
                                  className={rescanningId === link._id ? 'animate-spin' : ''}
                                />
                                {rescanningId === link._id ? 'Scanning...' : 'Re-Scan Safety'}
                              </button>

                              {/* Safety Override Submenu */}
                              <div className="border-t border-white/5">
                                <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider">
                                  Override Safety
                                </div>
                                <button
                                  onClick={() => handleSafetyOverride(link, 'safe')}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 flex items-center gap-2 text-green-400"
                                >
                                  <CheckCircle size={14} /> Mark Safe
                                </button>
                                <button
                                  onClick={() => handleSafetyOverride(link, 'malware')}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 flex items-center gap-2 text-red-400"
                                >
                                  <ShieldAlert size={14} /> Flag Malware
                                </button>
                                <button
                                  onClick={() => handleSafetyOverride(link, 'phishing')}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 flex items-center gap-2 text-orange-400"
                                >
                                  <ShieldOff size={14} /> Flag Phishing
                                </button>
                              </div>

                              <button
                                onClick={() => handleDelete(link._id)}
                                className="w-full text-left px-4 py-3 text-sm hover:bg-red-500/10 text-red-400 flex items-center gap-2 border-t border-white/5"
                              >
                                <Trash2 size={16} /> Delete Link
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expandable Details Row */}
                  {expandedLinkId === link._id && (
                    <tr className="bg-white/[0.02] border-t border-white/5">
                      <td colSpan="8" className="p-0">
                        <div className="p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                          {/* Compact Details Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                            {/* Password Status */}
                            <div className="bg-black/20 rounded-lg p-3">
                              <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                                <Lock size={12} /> Password
                              </div>
                              <div
                                className={
                                  link.password ? 'text-purple-400 font-medium' : 'text-gray-600'
                                }
                              >
                                {link.password
                                  ? '🔒 Protected'
                                  : link.isPasswordProtected
                                    ? '🔒 Protected'
                                    : 'None'}
                              </div>
                            </div>

                            {/* Expiration */}
                            <div className="bg-black/20 rounded-lg p-3">
                              <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                                <Timer size={12} /> Expires
                              </div>
                              <div
                                className={
                                  link.expiresAt
                                    ? new Date(link.expiresAt) < new Date()
                                      ? 'text-red-400'
                                      : 'text-amber-400'
                                    : 'text-gray-600'
                                }
                              >
                                {link.expiresAt
                                  ? new Date(link.expiresAt).toLocaleDateString()
                                  : 'Never'}
                              </div>
                            </div>

                            {/* Scheduled Start */}
                            <div className="bg-black/20 rounded-lg p-3">
                              <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                                <Calendar size={12} /> Scheduled
                              </div>
                              <div className={link.scheduledAt ? 'text-blue-400' : 'text-gray-600'}>
                                {link.scheduledAt
                                  ? new Date(link.scheduledAt).toLocaleDateString()
                                  : 'None'}
                              </div>
                            </div>

                            {/* Device Redirects */}
                            <div className="bg-black/20 rounded-lg p-3">
                              <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                                <Smartphone size={12} /> Device Rules
                              </div>
                              <div
                                className={
                                  link.deviceRedirects?.enabled
                                    ? 'text-cyan-400 font-medium'
                                    : 'text-gray-600'
                                }
                              >
                                {link.deviceRedirects?.enabled
                                  ? `${link.deviceRedirects.rules?.length || 0} Rules`
                                  : 'None'}
                              </div>
                            </div>

                            {/* Time Redirects */}
                            <div className="bg-black/20 rounded-lg p-3">
                              <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                                <Clock size={12} /> Time Rules
                              </div>
                              <div
                                className={
                                  link.timeRedirects?.enabled
                                    ? 'text-indigo-400 font-medium'
                                    : 'text-gray-600'
                                }
                              >
                                {link.timeRedirects?.enabled
                                  ? `${link.timeRedirects.rules?.length || 0} Rules`
                                  : 'None'}
                              </div>
                            </div>

                            {/* Safety Last Checked */}
                            <div className="bg-black/20 rounded-lg p-3">
                              <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                                <ShieldCheck size={12} /> Last Scan
                              </div>
                              <div className="text-gray-400">
                                {link.lastCheckedAt
                                  ? new Date(link.lastCheckedAt).toLocaleDateString()
                                  : 'Never'}
                              </div>
                            </div>
                          </div>

                          {/* Device Redirect URLs (if any) */}
                          {link.deviceRedirects?.enabled &&
                            link.deviceRedirects.rules?.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-white/5">
                                <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                  <Smartphone size={12} /> Device Redirect URLs:
                                </div>
                                <div className="flex flex-col gap-2">
                                  {link.deviceRedirects.rules.map((rule, i) => (
                                    <div
                                      key={i}
                                      className="flex items-center justify-between text-xs bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-2"
                                    >
                                      <div className="flex items-center gap-2 overflow-hidden">
                                        <span className="font-bold text-cyan-400 w-16 uppercase">
                                          {rule.device}
                                        </span>
                                        <span className="text-gray-300 truncate" title={rule.url}>
                                          {rule.url}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 ml-2">
                                        <button
                                          onClick={() => handleCopy(rule.url, 'Target URL')}
                                          className="p-1.5 hover:bg-cyan-500/20 rounded text-cyan-400 transition-colors"
                                          title="Copy URL"
                                        >
                                          <Copy size={12} />
                                        </button>
                                        <a
                                          href={rule.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1.5 hover:bg-cyan-500/20 rounded text-cyan-400 transition-colors"
                                          title="Visit URL"
                                        >
                                          <ExternalLink size={12} />
                                        </a>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          {/* Time Redirect URLs (if any) */}
                          {link.timeRedirects?.enabled && link.timeRedirects.rules?.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/5">
                              <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                <Clock size={12} /> Time Redirect URLs:
                              </div>
                              <div className="flex flex-col gap-2">
                                {link.timeRedirects.rules.map((rule, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between text-xs bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-2"
                                  >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      <span className="font-bold text-indigo-400 w-24">
                                        {rule.startTime} - {rule.endTime}
                                      </span>
                                      <span
                                        className="text-gray-300 truncate"
                                        title={rule.destination}
                                      >
                                        {rule.destination}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 ml-2">
                                      <button
                                        onClick={() =>
                                          handleCopy(rule.destination, 'Destination URL')
                                        }
                                        className="p-1.5 hover:bg-indigo-500/20 rounded text-indigo-400 transition-colors"
                                        title="Copy URL"
                                      >
                                        <Copy size={12} />
                                      </button>
                                      <a
                                        href={rule.destination}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 hover:bg-indigo-500/20 rounded text-indigo-400 transition-colors"
                                        title="Visit URL"
                                      >
                                        <ExternalLink size={12} />
                                      </a>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Manual Override Badge */}
                          {link.manualSafetyOverride && (
                            <div className="mt-3 pt-3 border-t border-white/5">
                              <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded border border-amber-500/20">
                                ⚠️ Manually Overridden - Background scans will not change safety
                                status
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </GlassTable>
      </div>

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <div className="text-sm text-gray-400">
            Showing <span className="text-white font-medium">{links.length}</span> of{' '}
            <span className="text-white font-medium">{totalLinks}</span> links
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-gray-400 hover:text-white transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLinks;
