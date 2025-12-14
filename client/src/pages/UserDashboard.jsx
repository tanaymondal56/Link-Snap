import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useConfirm } from '../context/ConfirmContext';
import {
  Copy,
  Check,
  Trash2,
  ExternalLink,
  BarChart2,
  Plus,
  Search,
  AlertCircle,
  Link as LinkIcon,
  X,
  Download,
  Edit3,
  Sparkles,
  QrCode,
  Ban,
  RefreshCw,
  Clock,
  Lock,
} from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import api from '../api/axios';
import showToast from '../components/ui/Toast';
import { handleApiError } from '../utils/errorHandler';
import { QRCodeSVG } from 'qrcode.react';
import { getShortUrl } from '../utils/urlHelper';
import CreateLinkModal from '../components/CreateLinkModal';
import EditLinkModal from '../components/EditLinkModal';
import LinkSuccessModal from '../components/LinkSuccessModal';
import { cacheLinks, getCachedLinks, getCacheAge } from '../utils/offlineCache';

const UserDashboard = () => {
  const confirm = useConfirm();
  const [links, setLinks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [qrModalLink, setQrModalLink] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [createdLink, setCreatedLink] = useState(null);
  const [ownerBanned, setOwnerBanned] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchLinks(page);
  }, [page]);

  const fetchLinks = async (pageNum = 1) => {
    try {
      setError(null);
      const { data } = await api.get(`/url/my-links?page=${pageNum}&limit=10`);
      setLinks(data.urls);
      setTotalPages(data.pages);
      setOwnerBanned(data.ownerBanned || false);
      // Cache the links for offline use (only cache first page for now or strategy needs update)
      if (pageNum === 1) cacheLinks(data.urls);
    } catch (error) {
      console.error(error);
      
      // If offline, try to load from cache
      if (!navigator.onLine) {
        const cached = getCachedLinks();
        if (cached && cached.links.length > 0) {
          setLinks(cached.links);
          showToast.info('Showing cached data (last updated ' + getCacheAge() + ')', 'Offline Mode');
        } else {
          setError('You\'re offline and no cached data is available.');
        }
      } else {
        setError('Failed to load your links. Please check your connection.');
        handleApiError(error, 'Failed to load links');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLinks(page);
    showToast.success('Links refreshed', 'Updated');
  };

  // Handle new link created from modal
  const handleLinkCreated = (newLink) => {
    setLinks([newLink, ...links]);
    setCreatedLink(newLink);
    // Don't show toast here, the success modal will handle it
  };

  // Handle link updated from edit modal
  const handleLinkUpdated = (updatedLink) => {
    setLinks(links.map((link) => (link._id === updatedLink._id ? updatedLink : link)));
    showToast.success('Link has been updated!', 'Changes Saved');
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Delete Link?',
      message:
        'This link will be permanently deleted and will no longer redirect. All analytics data will also be removed.',
      confirmText: 'Delete Link',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.delete(`/url/${id}`);
      setLinks(links.filter((link) => link._id !== id));
      showToast.success('Link has been removed', 'Deleted');
    } catch (error) {
      console.error(error);
      handleApiError(error, 'Failed to delete link');
    }
  };

  const copyToClipboard = (shortId) => {
    const shortUrl = getShortUrl(shortId);
    navigator.clipboard.writeText(shortUrl);
    setCopiedId(shortId);
    showToast.success('Link copied to clipboard!', 'Copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLinks = links.filter(
    (link) =>
      link.originalUrl.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.shortId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (link.title && link.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalClicks = links.reduce((acc, link) => acc + link.clicks, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 glass-dark rounded-2xl border border-red-500/20">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
          <AlertCircle size={32} />
        </div>
        <h3 className="text-lg font-medium text-white">Connection Error</h3>
        <p className="text-gray-400 mt-1 mb-4">{error}</p>
        <button
          onClick={() => {
            setIsLoading(true);
            fetchLinks();
          }}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Owner Banned Warning Banner */}
      {ownerBanned && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg shrink-0">
              <Ban className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-orange-300 font-semibold">Links Temporarily Disabled</h3>
              <p className="text-orange-200/80 text-sm mt-1">
                Your account has been suspended and your links are currently not redirecting. Please
                contact support if you believe this is an error.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">My Links</h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">
              {links.length} link{links.length !== 1 ? 's' : ''} • {totalClicks} click
              {totalClicks !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white p-2.5 sm:py-2.5 sm:px-4 rounded-xl font-medium transition-all disabled:opacity-50"
            title="Refresh links"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-2.5 px-5 rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 w-full sm:w-auto sm:self-start"
        >
          <Plus size={18} />
          <span className="sm:hidden">Create Link</span>
          <span className="hidden sm:inline">Create New Link</span>
        </button>
      </div>

      {/* Search */}
      <div className="w-full">
        <div className="relative w-full sm:max-w-md">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={16}
          />
          <input
            type="text"
            placeholder="Search links..."
            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Links Card View */}
      <div className="space-y-4">
        {filteredLinks.length === 0 ? (
          <div className="glass-dark rounded-xl border border-gray-800 p-12 text-center">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-600">
              <LinkIcon size={32} />
            </div>
            <p className="text-gray-300 font-medium text-lg">No links found</p>
            <p className="text-gray-500 text-sm mt-1">Create a new link above to get started</p>
          </div>
        ) : (
          filteredLinks.map((link) => {
            // Check if this link is effectively disabled (owner banned or link disabled)
            const isLinkDisabled = link.ownerBanned || !link.isActive;
            
            // Check expiration status
            const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
            const isExpiringSoon = link.expiresAt && !isExpired && 
              (new Date(link.expiresAt) - new Date()) < 24 * 60 * 60 * 1000; // Less than 24h
            
            // Calculate time remaining for display
            const getExpirationText = () => {
              if (!link.expiresAt) return null;
              if (isExpired) return 'Expired';
              const diff = new Date(link.expiresAt) - new Date();
              const hours = Math.floor(diff / (1000 * 60 * 60));
              const days = Math.floor(hours / 24);
              if (days > 0) return `${days}d left`;
              if (hours > 0) return `${hours}h left`;
              return 'Less than 1h';
            };

            return (
              <div key={link._id}>
              <div
                className={`glass-dark rounded-xl border overflow-hidden transition-colors ${
                  isLinkDisabled
                    ? 'border-orange-500/30 bg-orange-500/5'
                    : 'border-gray-800 hover:border-gray-700'
                }`}
              >
                {/* Disabled Banner */}
                {isLinkDisabled && (
                  <div className="bg-orange-500/10 border-b border-orange-500/20 px-5 py-2 flex items-center gap-2">
                    <Ban size={14} className="text-orange-400" />
                    <span className="text-orange-300 text-xs font-medium">
                      {link.ownerBanned ? 'Disabled (Account Suspended)' : 'Link Disabled'}
                    </span>
                  </div>
                )}

                {/* Main Card Content */}
                <div className="p-3 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-3 sm:gap-4">
                    {/* QR Code - Shows custom alias QR if available, otherwise random */}
                    <button
                      onClick={() => setQrModalLink(link)}
                      className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-lg transition-transform cursor-pointer self-center lg:self-start shrink-0 ${
                        isLinkDisabled ? 'bg-gray-200 opacity-60' : 'bg-white hover:scale-105'
                      }`}
                      title="Click to view QR code"
                    >
                      <QRCodeSVG
                        value={getShortUrl(link.customAlias || link.shortId)}
                        size={60}
                        level="H"
                        className="sm:w-20 sm:h-20"
                      />
                    </button>

                    {/* Link Info */}
                    <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
                      {/* Title & Original URL */}
                      <div className="text-center lg:text-left">
                        <h3
                          className={`font-semibold text-base sm:text-lg truncate ${isLinkDisabled ? 'text-gray-400' : 'text-white'}`}
                        >
                          {link.title || 'Untitled Link'}
                        </h3>
                        <p
                          className="text-gray-500 text-xs sm:text-sm truncate"
                          title={link.originalUrl}
                        >
                          → {link.originalUrl}
                        </p>
                      </div>

                      {/* Short Links */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row gap-2 sm:gap-3">
                        {/* Custom Alias - Show First if exists */}
                        {link.customAlias && (
                          <div
                            className={`flex items-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 ${
                              isLinkDisabled
                                ? 'bg-gray-800/30 border border-gray-700/30'
                                : 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20'
                            }`}
                          >
                            <Sparkles
                              size={12}
                              className={`sm:w-[14px] sm:h-[14px] ${
                                isLinkDisabled
                                  ? 'text-gray-500 shrink-0'
                                  : 'text-purple-400 shrink-0'
                              }`}
                            />
                            <span
                              className={`font-mono text-xs sm:text-sm truncate ${
                                isLinkDisabled
                                  ? 'text-gray-500 cursor-not-allowed'
                                  : 'text-purple-400 cursor-pointer hover:underline'
                              }`}
                              onClick={() => !isLinkDisabled && copyToClipboard(link.customAlias)}
                              title={isLinkDisabled ? 'Link is disabled' : 'Click to copy'}
                            >
                              /{link.customAlias}
                            </span>
                            <button
                              onClick={() => !isLinkDisabled && copyToClipboard(link.customAlias)}
                              className={`p-0.5 sm:p-1 rounded transition-colors shrink-0 ${
                                isLinkDisabled
                                  ? 'text-gray-600 cursor-not-allowed'
                                  : 'hover:bg-purple-500/20'
                              }`}
                              title={isLinkDisabled ? 'Link is disabled' : 'Copy custom link'}
                              disabled={isLinkDisabled}
                            >
                              {copiedId === link.customAlias ? (
                                <Check
                                  size={12}
                                  className="sm:w-[14px] sm:h-[14px] text-green-400"
                                />
                              ) : (
                                <Copy
                                  size={12}
                                  className={`sm:w-[14px] sm:h-[14px] ${isLinkDisabled ? 'text-gray-600' : 'text-purple-400'}`}
                                />
                              )}
                            </button>
                            {!isLinkDisabled && (
                              <a
                                href={getShortUrl(link.customAlias)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-0.5 sm:p-1 hover:bg-purple-500/20 rounded transition-colors shrink-0"
                                title="Open custom link"
                              >
                                <ExternalLink
                                  size={12}
                                  className="sm:w-[14px] sm:h-[14px] text-purple-400"
                                />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Random Short ID */}
                        <div
                          className={`flex items-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 ${
                            isLinkDisabled
                              ? 'bg-gray-800/30 border border-gray-700/30'
                              : 'bg-gray-800/50 border border-gray-700/50'
                          }`}
                        >
                          <LinkIcon
                            size={12}
                            className={`sm:w-[14px] sm:h-[14px] ${
                              isLinkDisabled ? 'text-gray-500 shrink-0' : 'text-blue-400 shrink-0'
                            }`}
                          />
                          <span
                            className={`font-mono text-xs sm:text-sm truncate ${
                              isLinkDisabled
                                ? 'text-gray-500 cursor-not-allowed'
                                : 'text-blue-400 cursor-pointer hover:underline'
                            }`}
                            onClick={() => !isLinkDisabled && copyToClipboard(link.shortId)}
                            title={isLinkDisabled ? 'Link is disabled' : 'Click to copy'}
                          >
                            /{link.shortId}
                          </span>
                          <button
                            onClick={() => !isLinkDisabled && copyToClipboard(link.shortId)}
                            className={`p-0.5 sm:p-1 rounded transition-colors shrink-0 ${
                              isLinkDisabled
                                ? 'text-gray-600 cursor-not-allowed'
                                : 'hover:bg-blue-500/20'
                            }`}
                            title={isLinkDisabled ? 'Link is disabled' : 'Copy random link'}
                            disabled={isLinkDisabled}
                          >
                            {copiedId === link.shortId ? (
                              <Check size={12} className="sm:w-[14px] sm:h-[14px] text-green-400" />
                            ) : (
                              <Copy
                                size={12}
                                className={`sm:w-[14px] sm:h-[14px] ${isLinkDisabled ? 'text-gray-600' : 'text-blue-400'}`}
                              />
                            )}
                          </button>
                          {!isLinkDisabled && (
                            <a
                              href={getShortUrl(link.shortId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-0.5 sm:p-1 hover:bg-blue-500/20 rounded transition-colors shrink-0"
                              title="Open random link"
                            >
                              <ExternalLink
                                size={12}
                                className="sm:w-[14px] sm:h-[14px] text-blue-400"
                              />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex flex-row lg:flex-col items-center lg:items-end justify-center gap-2 sm:gap-3 shrink-0">
                      {/* Click Count */}
                      <div
                        className={`flex items-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 ${
                          isLinkDisabled
                            ? 'bg-gray-800/30 border border-gray-700/30'
                            : 'bg-purple-500/10 border border-purple-500/20'
                        }`}
                      >
                        <BarChart2
                          size={12}
                          className={`sm:w-[14px] sm:h-[14px] ${isLinkDisabled ? 'text-gray-500' : 'text-purple-400'}`}
                        />
                        <span
                          className={`font-medium text-xs sm:text-sm ${isLinkDisabled ? 'text-gray-500' : 'text-purple-400'}`}
                        >
                          {link.clicks}
                        </span>
                        <span className="text-gray-500 text-[10px] sm:text-xs">clicks</span>
                      </div>

                      {/* Expiration Badge */}
                      {link.expiresAt && (
                        <div
                          className={`flex items-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 ${
                            isExpired
                              ? 'bg-red-500/10 border border-red-500/20'
                              : isExpiringSoon
                                ? 'bg-amber-500/10 border border-amber-500/20'
                                : 'bg-gray-800/30 border border-gray-700/30'
                          }`}
                          title={`Expires: ${new Date(link.expiresAt).toLocaleString()}`}
                        >
                          <Clock
                            size={12}
                            className={`sm:w-[14px] sm:h-[14px] ${
                              isExpired ? 'text-red-400' : isExpiringSoon ? 'text-amber-400' : 'text-gray-400'
                            }`}
                          />
                          <span
                            className={`font-medium text-[10px] sm:text-xs ${
                              isExpired ? 'text-red-400' : isExpiringSoon ? 'text-amber-400' : 'text-gray-400'
                            }`}
                          >
                            {getExpirationText()}
                          </span>
                        </div>
                      )}

                      {/* Password Protection Badge */}
                      {link.isPasswordProtected && (
                        <div
                          className="flex items-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-500/10 border border-purple-500/20"
                          title="Password protected"
                        >
                          <Lock
                            size={12}
                            className="sm:w-[14px] sm:h-[14px] text-purple-400"
                          />
                          <span className="font-medium text-[10px] sm:text-xs text-purple-400">
                            Protected
                          </span>
                        </div>
                      )}

                      {/* Date */}
                      <span className="text-gray-500 text-[10px] sm:text-xs">
                        {formatDate(link.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-800">
                    <div className="flex items-center gap-0.5 sm:gap-1">
                      <button
                        onClick={() => setEditingLink(link)}
                        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors text-xs sm:text-sm"
                        title="Edit link"
                      >
                        <Edit3 size={14} className="sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <Link
                        to={`/dashboard/analytics/${link.shortId}`}
                        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors text-xs sm:text-sm"
                        title="View analytics"
                      >
                        <BarChart2 size={14} className="sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Analytics</span>
                      </Link>
                      <button
                        onClick={() => setQrModalLink(link)}
                        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors text-xs sm:text-sm"
                        title="View QR codes"
                      >
                        <QrCode size={14} className="sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">QR</span>
                      </button>
                    </div>
                    <button
                      onClick={() => handleDelete(link._id)}
                      className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-xs sm:text-sm"
                      title="Delete link"
                    >
                      <Trash2 size={14} className="sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
            className="px-4 py-2 rounded-lg bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition"
          >
            Previous
          </button>
          <span className="text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || isLoading}
            className="px-4 py-2 rounded-lg bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition"
          >
            Next
          </button>
        </div>
      )}

      {/* QR Code Modal - Enhanced for both links */}
      {qrModalLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setQrModalLink(null)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg bg-gray-900/95 border border-gray-700/50 rounded-2xl shadow-2xl animate-modal-in max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700/50 sticky top-0 bg-gray-900/95 z-10">
              <div className="flex flex-col">
                <h3 className="text-lg font-semibold text-white">QR Codes</h3>
                <span className="text-sm text-gray-400">
                  {qrModalLink.title || 'Link QR Codes'}
                </span>
              </div>
              <button
                onClick={() => setQrModalLink(null)}
                className="p-2 hover:bg-gray-700/50 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* QR Codes Content */}
            <div className="p-5 space-y-5">
              {/* Custom Alias QR - Show first if exists */}
              {qrModalLink.customAlias && (
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-4 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={16} className="text-purple-400" />
                    <span className="text-sm font-medium text-purple-300">Custom Alias</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div id="qr-modal-custom" className="bg-white p-3 rounded-xl shadow-lg">
                      <QRCodeSVG
                        value={getShortUrl(qrModalLink.customAlias)}
                        size={150}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-purple-400 font-mono text-sm break-all">
                        {getShortUrl(qrModalLink.customAlias)}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyToClipboard(qrModalLink.customAlias)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors text-sm"
                        >
                          <Copy size={14} />
                          Copy
                        </button>
                        <button
                          onClick={() => {
                            const svg = document.querySelector('#qr-modal-custom svg');
                            if (!svg) return;
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            const data = new XMLSerializer().serializeToString(svg);
                            const img = new Image();
                            const svgBlob = new Blob([data], {
                              type: 'image/svg+xml;charset=utf-8',
                            });
                            const url = URL.createObjectURL(svgBlob);
                            img.onload = () => {
                              canvas.width = img.width;
                              canvas.height = img.height;
                              ctx.fillStyle = 'white';
                              ctx.fillRect(0, 0, canvas.width, canvas.height);
                              ctx.drawImage(img, 0, 0);
                              URL.revokeObjectURL(url);
                              const pngUrl = canvas.toDataURL('image/png');
                              const downloadLink = document.createElement('a');
                              downloadLink.href = pngUrl;
                              downloadLink.download = `qr-${qrModalLink.customAlias}.png`;
                              downloadLink.click();
                            };
                            img.src = url;
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors text-sm"
                        >
                          <Download size={14} />
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Random ID QR */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <LinkIcon size={16} className="text-blue-400" />
                  <span className="text-sm font-medium text-blue-300">Random Short ID</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div id="qr-modal-random" className="bg-white p-3 rounded-xl shadow-lg">
                    <QRCodeSVG
                      value={getShortUrl(qrModalLink.shortId)}
                      size={150}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-blue-400 font-mono text-sm break-all">
                      {getShortUrl(qrModalLink.shortId)}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(qrModalLink.shortId)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors text-sm"
                      >
                        <Copy size={14} />
                        Copy
                      </button>
                      <button
                        onClick={() => {
                          const svg = document.querySelector('#qr-modal-random svg');
                          if (!svg) return;
                          const canvas = document.createElement('canvas');
                          const ctx = canvas.getContext('2d');
                          const data = new XMLSerializer().serializeToString(svg);
                          const img = new Image();
                          const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
                          const url = URL.createObjectURL(svgBlob);
                          img.onload = () => {
                            canvas.width = img.width;
                            canvas.height = img.height;
                            ctx.fillStyle = 'white';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(img, 0, 0);
                            URL.revokeObjectURL(url);
                            const pngUrl = canvas.toDataURL('image/png');
                            const downloadLink = document.createElement('a');
                            downloadLink.href = pngUrl;
                            downloadLink.download = `qr-${qrModalLink.shortId}.png`;
                            downloadLink.click();
                          };
                          img.src = url;
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm"
                      >
                        <Download size={14} />
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Original URL */}
              <div className="bg-gray-800/30 rounded-xl p-3 border border-gray-700/30">
                <p className="text-xs text-gray-500 mb-1">Redirects to</p>
                <p className="text-gray-300 text-sm break-all">{qrModalLink.originalUrl}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Link Modal */}
      <CreateLinkModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleLinkCreated}
      />

      {/* Edit Link Modal */}
      <EditLinkModal
        isOpen={!!editingLink}
        onClose={() => setEditingLink(null)}
        onSuccess={handleLinkUpdated}
        link={editingLink}
      />

      {/* Link Success Modal - Shows after creating a link */}
      <LinkSuccessModal
        isOpen={!!createdLink}
        onClose={() => setCreatedLink(null)}
        linkData={createdLink}
      />
    </div>
  );
};

export default UserDashboard;
