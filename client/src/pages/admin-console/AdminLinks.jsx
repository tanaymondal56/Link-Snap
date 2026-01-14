import { useState, useEffect, useCallback } from 'react';
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
  Clock,
  Filter
} from 'lucide-react';
import GlassTable from '../../components/admin-console/ui/GlassTable';
import api from '../../api/axios';
import { useConfirm } from '../../context/ConfirmContext';
import showToast from '../../utils/toastUtils';
import { Link } from 'react-router-dom';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { Loader2 } from 'lucide-react';

const AdminLinks = () => {
  const confirm = useConfirm();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
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
                status: statusFilter
            }
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
  }, [debouncedSearch, page, statusFilter]);

  const isRefreshing = usePullToRefresh(async () => {
    // Silent refresh
    try {
        const { data } = await api.get(`/admin/links?search=${debouncedSearch}&status=${statusFilter}`);
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
    fetchLinks();
  }, [fetchLinks]);

  const handleToggleStatus = async (link) => {
    setOpenActionId(null);
    try {
      await api.patch(`/admin/links/${link._id}/status`);
      setLinks(links.map(l => l._id === link._id ? { ...l, isActive: !l.isActive } : l));
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
          setPage(prev => prev - 1);
      } else {
          setLinks(links.filter(l => l._id !== linkId));
      }

      setTotalLinks(prev => prev - 1);
      showToast.success('Link deleted');
    } catch {
      showToast.error('Failed to delete link');
    }
  };

  // Compute stats
  const stats = {
    total: totalLinks, 
    active: links.filter(l => l.isActive).length,
    disabled: links.filter(l => !l.isActive).length,
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
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading links...</div>
        ) : links.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No links found</div>
        ) : (
          links.map((link) => (
            <div key={link._id} className={`bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 ${link.ownerBanned ? 'bg-orange-500/5' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <span className="font-mono text-blue-400 text-lg">/{link.shortId}</span>
                   {link.customAlias && <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded-lg">/{link.customAlias}</span>}
                </div>
                <div className="text-xs text-gray-500">{new Date(link.createdAt).toLocaleDateString()}</div>
              </div>

               {/* Mobile Safety Badge */}
               <div className="flex items-center gap-2 mb-2">
                  {link.safetyStatus === 'safe' && <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded border border-green-500/20">Safe</span>}
                  {(link.safetyStatus === 'malware' || link.safetyStatus === 'phishing') && <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 font-bold uppercase">{link.safetyStatus}</span>}
               </div>
              
              <div className="text-sm text-gray-400 truncate border-l-2 border-white/10 pl-2">
                {link.originalUrl}
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">
                    By: {link.createdBy?.username ? `@${link.createdBy.username}` : (link.createdBy?.email || link.userId?.email || 'Anonymous')}
                  </span>
                   {link.ownerBanned && <span className="text-orange-400 flex items-center gap-1"><UserX size={10} /> Banned</span>}
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
                            <span className="text-orange-400 font-bold text-sm leading-tight">Owner Banned</span>
                            <span className={`text-[10px] ${!link.createdBy?.disableLinksOnBan ? 'text-green-400' : 'text-red-400'}`}>
                                {!link.createdBy?.disableLinksOnBan ? '(Link Active)' : '(Link Disabled)'}
                            </span>
                        </>
                     ) : (link.expiresAt && new Date(link.expiresAt) < new Date()) ? (
                        <span className="text-amber-400 font-bold">Expired</span>
                     ) : (
                        <span className="text-green-400 font-bold">Active</span>
                     )}
                   </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                 <button 
                  onClick={() => window.open(link.originalUrl, '_blank')}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-gray-300"
                 >
                   Open URL
                 </button>
                 <button
                  onClick={() => handleDelete(link._id)}
                   className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-xs font-medium text-red-400"
                 >
                   Delete
                 </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
      <GlassTable headers={['Short Link', 'Custom Alias', 'Original URL', 'Safety', 'Owner', 'Clicks', 'Status', 'Actions']}>
        {loading ? (
          <tr>
            <td colSpan="8" className="p-8 text-center text-gray-500">Loading links...</td>
          </tr>
        ) : links.length === 0 ? (
          <tr>
            <td colSpan="8" className="p-8 text-center text-gray-500">No links found</td>
          </tr>
        ) : (
          links.map((link) => {
            const isOwnerBanned = link.ownerBanned;
            const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
            return (
            <tr key={link._id} className={`hover:bg-white/5 transition-colors group ${isOwnerBanned ? 'bg-orange-500/5' : ''}`}>
              <td className="p-4 whitespace-nowrap">
                <div className="flex flex-col">
                  <span className="font-mono text-blue-400">/{link.shortId}</span>
                  <span className="text-xs text-gray-500">{new Date(link.createdAt).toLocaleDateString()}</span>
                </div>
              </td>
              <td className="p-4 whitespace-nowrap">
                {link.customAlias ? (
                  <span className="font-mono text-purple-400">/{link.customAlias}</span>
                ) : (
                  <span className="text-gray-600">—</span>
                )}
              </td>
              <td className="p-4 max-w-[200px]">
                <div className="truncate text-gray-300" title={link.originalUrl}>
                  {link.originalUrl}
                </div>
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
                  {(link.safetyStatus === 'pending' || link.safetyStatus === 'unknown' || !link.safetyStatus) && (
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
                    <span className="text-amber-400 text-xs flex items-center gap-1 w-fit" title={`Expired on ${new Date(link.expiresAt).toLocaleDateString()}`}>
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
                    onClick={() => setOpenActionId(openActionId === link._id ? null : link._id)}
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
                        <Link 
                           to={`/dashboard/analytics/${link.customAlias || link.shortId}`}
                           className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 flex items-center gap-2 text-gray-300 hover:text-white"
                        >
                          <BarChart2 size={16} /> View Analytics
                        </Link>
                        <button 
                          onClick={() => handleToggleStatus(link)}
                          className={`w-full text-left px-4 py-3 text-sm hover:bg-white/5 flex items-center gap-2 ${link.isActive ? 'text-orange-400' : 'text-green-400'}`}
                        >
                          {link.isActive ? <Ban size={16} /> : <CheckCircle size={16} />} 
                          {link.isActive ? 'Disable Link' : 'Enable Link'}
                        </button>
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
          );
          })
        )}
      </GlassTable>
      </div>

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <div className="text-sm text-gray-400">
            Showing <span className="text-white font-medium">{links.length}</span> of <span className="text-white font-medium">{totalLinks}</span> links
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
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
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
