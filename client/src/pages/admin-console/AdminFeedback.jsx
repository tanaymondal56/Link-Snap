import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MessageSquare, 
  Search, 
  Lightbulb, 
  Bug, 
  TrendingUp,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trash2,
  Clock,
  User,
  Mail,
  ThumbsUp,
  RefreshCw
} from 'lucide-react';
import api from '../../api/axios';
import showToast from '../../utils/toastUtils';
import { useConfirm } from '../../context/ConfirmContext';
import { formatDateTime } from '../../utils/dateUtils';

import { useAuth } from '../../context/AuthContext';

const typeConfig = {
  feature_request: { label: 'Feature Request', icon: Lightbulb, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  bug_report: { label: 'Bug Report', icon: Bug, color: 'text-red-400', bg: 'bg-red-500/20' },
  improvement: { label: 'Improvement', icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  question: { label: 'Question', icon: HelpCircle, color: 'text-amber-400', bg: 'bg-amber-500/20' },
};

const statusConfig = {
  new: { label: 'New', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  under_review: { label: 'Under Review', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  planned: { label: 'Planned', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  in_progress: { label: 'In Progress', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  completed: { label: 'Completed', color: 'text-green-400', bg: 'bg-green-500/20' },
  declined: { label: 'Declined', color: 'text-gray-400', bg: 'bg-gray-500/20' },
};

const priorityConfig = {
  low: { label: 'Low', color: 'text-gray-400' },
  medium: { label: 'Medium', color: 'text-yellow-400' },
  high: { label: 'High', color: 'text-orange-400' },
  critical: { label: 'Critical', color: 'text-red-400' },
};

const AdminFeedback = () => {
  const { isAuthChecking } = useAuth();
  const confirm = useConfirm();
  // Two separate lists
  const [activeFeedback, setActiveFeedback] = useState([]);
  const [resolvedFeedback, setResolvedFeedback] = useState([]);
  const [stats, setStats] = useState(null);
  
  // Loading states
  const [loadingActive, setLoadingActive] = useState(true);
  const [loadingResolved, setLoadingResolved] = useState(false);
  
  // Pagination
  const [activePage, setActivePage] = useState(1);
  const [activeTotalPages, setActiveTotalPages] = useState(1);
  const [resolvedPage, setResolvedPage] = useState(1);
  const [resolvedTotalPages, setResolvedTotalPages] = useState(1);
  
  // UI State
  const [showResolved, setShowResolved] = useState(false);
  
  // Filters (Global)
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active'); // Default to active
  const [sortBy, setSortBy] = useState('newest');
  const searchTimeout = useRef(null);
  
  // Expanded row & notes
  const [expandedId, setExpandedId] = useState(null);
  const [editingNotes, setEditingNotes] = useState({});

  // Debounce search input
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
      setActivePage(1);
      setResolvedPage(1);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  // Fetch Active Feedback
  const fetchActiveFeedback = useCallback(async () => {
    setLoadingActive(true);
    try {
      const params = { page: activePage, limit: 20, status: 'active' };
      if (search) params.search = search;
      if (filterType !== 'all') params.type = filterType;
      // Filter status logic: if user explicitly selects a status, use it
      // But typically 'active' means New/Planned/etc.
      // If user filters by 'new', both lists technically could match if we aren't strict.
      // BUT current requirement: "remove completed options".
      // So detailed status filter should NOT include completed/declined.
      if (filterStatus !== 'active' && filterStatus !== 'all') params.status = filterStatus;
      
      if (sortBy === 'votes') params.sort = 'votes';
      else if (sortBy === 'oldest') params.sort = 'oldest';
      
      const { data } = await api.get('/admin/feedback', { params });
      setActiveFeedback(data.feedback);
      setActiveTotalPages(data.pages);
    } catch (error) {
      console.error('Failed to fetch active feedback:', error);
      showToast.error('Failed to load feedback');
    } finally {
      setLoadingActive(false);
    }
  }, [activePage, search, filterType, filterStatus, sortBy]);

  // Fetch Resolved Feedback (only if shown)
  const fetchResolvedFeedback = useCallback(async () => {
    if (!showResolved) return;
    setLoadingResolved(true);
    try {
      const params = { page: resolvedPage, limit: 10, status: 'resolved' };
      if (search) params.search = search;
      if (filterType !== 'all') params.type = filterType;
      // No status filter for resolved list (implied completed/declined)
      
      if (sortBy === 'votes') params.sort = 'votes';
      else if (sortBy === 'oldest') params.sort = 'oldest';
      
      const { data } = await api.get('/admin/feedback', { params });
      setResolvedFeedback(data.feedback);
      setResolvedTotalPages(data.pages);
    } catch (error) {
      console.error('Failed to fetch resolved feedback:', error);
    } finally {
      setLoadingResolved(false);
    }
  }, [resolvedPage, search, filterType, sortBy, showResolved]);

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/admin/feedback/stats');
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    if (!isAuthChecking) {
      fetchActiveFeedback();
    }
  }, [fetchActiveFeedback, isAuthChecking]);

  useEffect(() => {
    if (!isAuthChecking) {
      fetchResolvedFeedback();
    }
  }, [fetchResolvedFeedback, isAuthChecking]);

  useEffect(() => {
    if (!isAuthChecking) {
      fetchStats();
    }
  }, [isAuthChecking]);

  // Generic Update Handler
  const handleUpdate = async (id, payload) => {
    try {
      const { data } = await api.patch(`/admin/feedback/${id}`, payload);
      const updatedItem = data.feedback;
      
      // Optimistic update logic is complex with two lists, simpler to just refetch relevant lists
      // or filter it out.
      showToast.success('Feedback updated');
      
      // If status changed to resolved, remove from active
      if (payload.status) {
         fetchActiveFeedback();
         if (showResolved) fetchResolvedFeedback();
         fetchStats();
      } else {
         // Just data update (notes/priority), local map
         setActiveFeedback(prev => prev.map(f => f._id === id ? updatedItem : f));
         setResolvedFeedback(prev => prev.map(f => f._id === id ? updatedItem : f));
      }

    } catch (error) {
      console.error('Update error:', error);
      showToast.error('Update failed');
    }
  };

  const handleDelete = async (id) => {
    if (!await confirm({ title: 'Delete Feedback?', message: 'Permanently delete this item?', variant: 'danger' })) return;
    try {
      await api.delete(`/admin/feedback/${id}`);
      setActiveFeedback(prev => prev.filter(f => f._id !== id));
      setResolvedFeedback(prev => prev.filter(f => f._id !== id));
      showToast.success('Feedback deleted');
      fetchStats();
    } catch (error) {
       console.error('Delete error:', error);
       showToast.error('Delete failed');
    }
  };

  const toggleExpand = (id, listType) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      const list = listType === 'active' ? activeFeedback : resolvedFeedback;
      const item = list.find(f => f._id === id);
      if (item && !(id in editingNotes)) {
        setEditingNotes(prev => ({ ...prev, [id]: item.adminNotes || '' }));
      }
    }
  };

  const handleExport = async () => {
    try {
      showToast.success('Export started');
      const response = await api.get('/admin/feedback/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `feedback_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export error:', error);
      showToast.error('Failed to export feedback');
    }
  };

  // Helper to render a feedback list
  const renderList = (items, listType) => (
    <div className="space-y-4">
      {items.map((item) => {
        const typeInfo = typeConfig[item.type] || typeConfig.feature_request;
        const statusInfo = statusConfig[item.status] || statusConfig.new;
        const priorityInfo = priorityConfig[item.priority] || priorityConfig.medium;
        const TypeIcon = typeInfo.icon;
        const isExpanded = expandedId === item._id;
        
        return (
          <div key={item._id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden hover:border-gray-600/50 transition-colors">
            <div className="p-4 cursor-pointer" onClick={() => toggleExpand(item._id, listType)}>
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${typeInfo.bg} shrink-0`}>
                  <TypeIcon size={20} className={typeInfo.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-medium text-white truncate">{item.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    <span className={`text-xs font-medium ${priorityInfo.color}`}>{priorityInfo.label}</span>
                  </div>
                  <p className="text-gray-400 text-sm line-clamp-1">{item.message}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Clock size={12} />{formatDateTime(item.createdAt)}</span>
                    <span className="flex items-center gap-1"><ThumbsUp size={12} />{item.voteCount || 0} votes</span>
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {item.user?.username ? (
                        <span className="text-purple-400">@{item.user.username}</span>
                      ) : (
                        item.email || item.user?.email || 'Anonymous'
                      )}
                    </span>
                  </div>
                </div>
                <button className="p-1 text-gray-400 hover:text-white">
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>
            </div>
            {isExpanded && (
              <div className="p-4 pt-0 border-t border-gray-700/50 bg-gray-900/30">
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Full Message</label>
                    <div className="bg-gray-800 rounded-lg p-3 text-gray-300 text-sm max-h-40 overflow-y-auto">{item.message}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-400 mb-2 block">Admin Notes</label>
                    <textarea
                      value={editingNotes[item._id] ?? item.adminNotes ?? ''}
                      onChange={(e) => setEditingNotes(prev => ({ ...prev, [item._id]: e.target.value }))}
                      placeholder="Add internal notes..."
                      className="w-full bg-gray-800 rounded-lg p-3 text-gray-300 text-sm resize-none h-24 border border-gray-700 focus:border-purple-500 focus:outline-none"
                    />
                    <button
                      onClick={() => handleUpdate(item._id, { adminNotes: editingNotes[item._id] })}
                      className="mt-2 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg"
                    >
                      Save Notes
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-700/50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Status:</span>
                    <select
                      value={item.status}
                      onChange={(e) => handleUpdate(item._id, { status: e.target.value })}
                      className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none"
                    >
                      {Object.keys(statusConfig).map(key => <option key={key} value={key}>{statusConfig[key].label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Priority:</span>
                    <select
                      value={item.priority}
                      onChange={(e) => handleUpdate(item._id, { priority: e.target.value })}
                      className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none"
                    >
                      {Object.keys(priorityConfig).map(key => <option key={key} value={key}>{priorityConfig[key].label}</option>)}
                    </select>
                  </div>
                  <button onClick={() => handleDelete(item._id)} className="flex items-center gap-1 px-3 py-1.5 text-red-400 hover:bg-red-500/10 rounded-lg text-sm ml-auto">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Feedback</h1>
          <p className="text-gray-400">Manage user feedback and feature requests</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { fetchActiveFeedback(); fetchStats(); if(showResolved) fetchResolvedFeedback(); }} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">
            <RefreshCw size={18} /> Refresh
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <TrendingUp size={18} className="rotate-90" /> Export CSV
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <p className="text-gray-400 text-sm">Total Feedback</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-blue-400 text-sm">New</p>
            <p className="text-2xl font-bold text-blue-400">{stats.new}</p>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
            <p className="text-purple-400 text-sm">Feature Requests</p>
            <p className="text-2xl font-bold text-purple-400">{stats.byType?.feature_request || 0}</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
            <p className="text-green-400 text-sm">Completed</p>
            <p className="text-2xl font-bold text-green-400">{stats.byStatus?.completed || 0}</p>
          </div>
        </div>
      )}

      {/* Main Filters (Active List) */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Search feedback..."
            value={searchInput}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
        </div>
        <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setActivePage(1); }} className="px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-purple-500">
          <option value="all">All Types</option>
          {Object.keys(typeConfig).map(k => <option key={k} value={k}>{typeConfig[k].label}</option>)}
        </select>
        {/* Adjusted Status Filter: Only show Active statuses */}
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setActivePage(1); }} className="px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-purple-500">
          <option value="all">All Active</option>
          <option value="new">New</option>
          <option value="under_review">Under Review</option>
          <option value="planned">Planned</option>
          <option value="in_progress">In Progress</option>
        </select>
        <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setActivePage(1); }} className="px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-purple-500">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="votes">Most Votes</option>
        </select>
      </div>

      {/* Active Feedback List */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          Active Feedback
        </h2>
        
        {loadingActive ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-purple-400 animate-spin" /></div>
        ) : activeFeedback.length === 0 ? (
          <div className="text-center py-10 bg-gray-800/30 rounded-2xl border border-gray-700/50 text-gray-400">
            No active feedback found.
          </div>
        ) : (
          renderList(activeFeedback, 'active')
        )}

        {/* Active Pagination */}
        {activeTotalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => setActivePage(p => Math.max(1, p - 1))} disabled={activePage === 1} className="px-3 py-1.5 bg-gray-800 rounded-lg text-white disabled:opacity-50 text-sm">Prev</button>
            <span className="text-gray-400 text-sm">Page {activePage} of {activeTotalPages}</span>
            <button onClick={() => setActivePage(p => Math.min(activeTotalPages, p + 1))} disabled={activePage === activeTotalPages} className="px-3 py-1.5 bg-gray-800 rounded-lg text-white disabled:opacity-50 text-sm">Next</button>
          </div>
        )}
      </div>

      {/* Resolved Feedback Section (Collapsed) */}
      <div className="pt-8 border-t border-gray-800">
        <button 
          onClick={() => setShowResolved(!showResolved)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors w-full p-2 hover:bg-gray-800/50 rounded-lg"
        >
          {showResolved ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          <span className="font-medium text-lg">Resolved & Archived Feedback</span>
          <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-full text-gray-500">Completed / Declined</span>
        </button>

        {showResolved && (
          <div className="mt-4 animate-in slide-in-from-top-2 fade-in duration-200">
             {loadingResolved ? (
               <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-gray-500 animate-spin" /></div>
             ) : resolvedFeedback.length === 0 ? (
               <div className="text-center py-8 text-gray-500">No resolved feedback yet.</div>
             ) : (
               <>
                 {renderList(resolvedFeedback, 'resolved')}
                 {resolvedTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <button onClick={() => setResolvedPage(p => Math.max(1, p - 1))} disabled={resolvedPage === 1} className="px-3 py-1.5 bg-gray-800 rounded-lg text-white disabled:opacity-50 text-sm">Prev</button>
                      <span className="text-gray-400 text-sm">Page {resolvedPage} of {resolvedTotalPages}</span>
                      <button onClick={() => setResolvedPage(p => Math.min(resolvedTotalPages, p + 1))} disabled={resolvedPage === resolvedTotalPages} className="px-3 py-1.5 bg-gray-800 rounded-lg text-white disabled:opacity-50 text-sm">Next</button>
                    </div>
                 )}
               </>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFeedback;
