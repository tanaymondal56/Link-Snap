import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/axios';
import showToast from '../../utils/toastUtils';
import { useConfirm } from '../../context/ConfirmContext';
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  X,
  Sparkles,
  Rocket,
  Shield,
  Zap,
  BarChart3,
  Bell,
  Bug,
  Star,
  Gift,
  Flame,
  Heart,
  Loader2,
} from 'lucide-react';
import { formatDate, formatDateTime, toInputDate, toInputDateTime } from '../../utils/dateUtils';

// Icon mapping
const iconMap = {
  Sparkles: { icon: Sparkles, color: 'text-yellow-400' },
  Rocket: { icon: Rocket, color: 'text-red-400' },
  Shield: { icon: Shield, color: 'text-green-400' },
  Zap: { icon: Zap, color: 'text-amber-400' },
  BarChart3: { icon: BarChart3, color: 'text-blue-400' },
  Bell: { icon: Bell, color: 'text-purple-400' },
  Bug: { icon: Bug, color: 'text-orange-400' },
  Star: { icon: Star, color: 'text-yellow-400' },
  Gift: { icon: Gift, color: 'text-pink-400' },
  Flame: { icon: Flame, color: 'text-red-500' },
  Heart: { icon: Heart, color: 'text-rose-400' },
};

// Change type styles
const changeTypeStyles = {
  feature: { label: '✨ New', bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  improvement: { label: '⬆️ Improved', bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  fix: { label: '🐛 Fixed', bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  note: { label: '📝 Note', bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  breaking: { label: '⚠️ Breaking', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  deprecated: { label: '🗑️ Removed', bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
};

// Release type gradients
const releaseTypeGradients = {
  major: 'from-purple-500 to-pink-500',
  minor: 'from-blue-500 to-cyan-500',
  patch: 'from-green-500 to-teal-500',
  initial: 'from-amber-500 to-orange-500',
};

const ChangelogManager = () => {
  const confirm = useConfirm();
  const [changelogs, setChangelogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [suggestedVersion, setSuggestedVersion] = useState('0.1.0');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, published, draft
  const [selectedIds, setSelectedIds] = useState([]); // Bulk selection
  const [editingUpdatedAt, setEditingUpdatedAt] = useState(null); // For concurrent edit detection
  const formModalRef = useRef(null); // Bug #4: Ref for scrolling modal to top
  
  const DRAFT_KEY = 'changelog_draft';
  
  // Form state
  const [form, setForm] = useState({
    version: '',
    date: toInputDate(new Date()),
    title: '',
    description: '',
    type: 'minor',
    icon: 'Sparkles',
    changes: [{ type: 'feature', text: '' }],
    isPublished: false,
    scheduledFor: '', // ISO datetime string for scheduled publishing
    // Roadmap fields
    showOnRoadmap: false,
    roadmapStatus: 'planned',
    estimatedRelease: '',
    roadmapPriority: 0,
  });
  const [historyModal, setHistoryModal] = useState(null); // Holds changelog to show history

  // Reset form
  const resetForm = useCallback(() => {
    setForm({
      version: suggestedVersion,
      date: toInputDate(new Date()),
      title: '',
      description: '',
      type: 'minor',
      icon: 'Sparkles',
      changes: [{ type: 'feature', text: '' }],
      isPublished: false,
      scheduledFor: '',
      showOnRoadmap: false,
      roadmapStatus: 'planned',
      estimatedRelease: '',
      roadmapPriority: 0,
    });
    setEditingId(null);
    setEditingUpdatedAt(null);
  }, [suggestedVersion]);

  // Open create form (check for saved draft)
  const handleCreate = useCallback(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.title || draft.changes?.some(c => c.text)) {
          setForm({ ...draft, version: draft.version || suggestedVersion });
          setEditingId(null);
          setShowForm(true);
          showToast.success('Draft restored');
          return;
        }
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
    resetForm();
    setForm(prev => ({ ...prev, version: suggestedVersion }));
    setShowForm(true);
  }, [DRAFT_KEY, suggestedVersion, resetForm]);

  // Auto-save form to localStorage
  useEffect(() => {
    if (showForm && !editingId) {
      const hasContent = form.title.trim() || form.changes.some(c => c.text.trim());
      if (hasContent) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      }
    }
  }, [form, showForm, editingId]);

  // Recover draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.title || draft.changes?.some(c => c.text)) {
          // Show recovery option via toast
          showToast.info('Draft recovered. Click "New Release" to continue editing.');
        }
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        // Allow Escape to close form even from inputs
        if (e.key === 'Escape' && showForm) {
          setShowForm(false);
          resetForm();
        }
        return;
      }

      // Ctrl+N or Cmd+N: New Release
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (!showForm) {
          handleCreate();
        }
      }

      // Escape: Close form
      if (e.key === 'Escape' && showForm) {
        setShowForm(false);
        resetForm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showForm, handleCreate, resetForm]);

  // Bug #4: Scroll form modal to top when opened + lock body scroll
  useEffect(() => {
    if (showForm) {
      // Lock body scroll
      document.body.style.overflow = 'hidden';
      if (formModalRef.current) {
        formModalRef.current.scrollTop = 0;
      }
    } else {
      // Unlock body scroll
      document.body.style.overflow = '';
    }
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
    };
  }, [showForm]);

  // Fetch changelogs
  const fetchChangelogs = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/changelog/admin');
      setChangelogs(data);
    } catch (error) {
      console.error('Failed to fetch changelogs:', error);
      showToast.error('Failed to load changelogs');
    } finally {
      setLoading(false);
    }
  };

  // Fetch suggested version
  const fetchSuggestedVersion = async () => {
    try {
      const { data } = await api.get('/changelog/admin/latest-version');
      setSuggestedVersion(data.suggestedVersion || '0.1.0');
    } catch {
      console.error('Failed to fetch version suggestion');
    }
  };

  useEffect(() => {
    fetchChangelogs();
    fetchSuggestedVersion();
  }, []);

  // Clear draft from localStorage
  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
  };

  // Open edit form
  const handleEdit = (changelog) => {
    setForm({
      version: changelog.version,
      date: toInputDate(changelog.date),
      title: changelog.title,
      description: changelog.description || '',
      type: changelog.type,
      icon: changelog.icon,
      changes: changelog.changes,
      isPublished: changelog.isPublished,
      scheduledFor: changelog.scheduledFor ? toInputDateTime(changelog.scheduledFor) : '',
      showOnRoadmap: changelog.showOnRoadmap || false,
      roadmapStatus: changelog.roadmapStatus || 'planned',
      estimatedRelease: changelog.estimatedRelease || '',
      roadmapPriority: changelog.roadmapPriority || 0,
    });
    setEditingId(changelog._id);
    setEditingUpdatedAt(changelog.updatedAt); // Track for conflict detection
    setShowForm(true);
  };

  // Save changelog
  const handleSave = async () => {
    // Validation
    if (!form.version.trim()) {
      showToast.error('Version is required');
      return;
    }
    if (!form.title.trim()) {
      showToast.error('Title is required');
      return;
    }
    if (form.changes.length === 0 || !form.changes.some(c => c.text.trim())) {
      showToast.error('At least one change is required');
      return;
    }

    // Filter empty changes
    const cleanChanges = form.changes.filter(c => c.text.trim());

    // Prepare payload with UTC date for scheduledFor
    const payload = { ...form, changes: cleanChanges };
    
    if (payload.scheduledFor) {
      // Input gives local time "YYYY-MM-DDTHH:mm", new Date() parses it as local
      // toISOString() converts it to UTC for the server
      payload.scheduledFor = new Date(payload.scheduledFor).toISOString();
    }

    try {
      setSaving(true);
      
      if (editingId) {
        await api.put(`/changelog/admin/${editingId}`, {
          ...payload,
          _lastModified: editingUpdatedAt, // Send for optimistic locking
        });
        showToast.success('Changelog updated');
      } else {
        await api.post('/changelog/admin', payload);
        showToast.success('Changelog created');
      }

      setShowForm(false);
      resetForm();
      clearDraft(); // Clear draft from localStorage on successful save
      fetchChangelogs();
      fetchSuggestedVersion();
    } catch (error) {
      // Handle concurrent edit conflict
      if (error.response?.status === 409 && error.response?.data?.conflict) {
        showToast.error('This changelog was modified by another user. Please close and reopen to get latest changes.');
      } else {
        const message = error.response?.data?.message || 'Failed to save';
        showToast.error(message);
      }
    } finally {
      setSaving(false);
    }
  };

  // Delete changelog
  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Delete Changelog',
      message: 'Are you sure you want to delete this changelog entry?',
      confirmText: 'Delete',
      type: 'danger',
    });

    if (!confirmed) return;

    try {
      await api.delete(`/changelog/admin/${id}`);
      showToast.success('Changelog deleted');
      // Bug fix: Clear deleted item from selection
      setSelectedIds(prev => prev.filter(i => i !== id));
      fetchChangelogs();
    } catch {
      showToast.error('Failed to delete');
    }
  };

  // Toggle publish with confirmation
  const handleTogglePublish = async (id) => {
    const changelog = changelogs.find(c => c._id === id);
    if (!changelog) return;

    // Show confirmation before publishing (but not for unpublishing)
    if (!changelog.isPublished) {
      const confirmed = await confirm({
        title: 'Publish Changelog',
        message: `Are you sure you want to publish "${changelog.title}"? This will make it visible to all users.`,
        confirmText: 'Publish',
        type: 'info',
      });
      if (!confirmed) return;
    }

    try {
      const { data } = await api.patch(`/changelog/admin/${id}/publish`);
      setChangelogs(prev => 
        prev.map(c => c._id === id ? { ...c, isPublished: data.isPublished, updatedAt: data.updatedAt } : c)
      );
      // Fix: If we're currently editing this changelog, update the timestamp to prevent conflict
      if (editingId === id && data.updatedAt) {
        setEditingUpdatedAt(data.updatedAt);
      }
      showToast.success(data.isPublished ? 'Published' : 'Unpublished');
    } catch {
      showToast.error('Failed to toggle publish');
    }
  };

  // Export all published changelogs to Markdown
  const handleExportMarkdown = () => {
    const published = changelogs.filter(c => c.isPublished);
    if (published.length === 0) {
      showToast.error('No published changelogs to export');
      return;
    }

    let markdown = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
    
    published.forEach(changelog => {
      const date = formatDate(changelog.date);
      markdown += `## [${changelog.version}] - ${date}\n\n`;
      markdown += `### ${changelog.title}\n\n`;
      
      if (changelog.description) {
        markdown += `${changelog.description}\n\n`;
      }
      
      changelog.changes.forEach(change => {
        const typeEmoji = {
          feature: '✨',
          improvement: '⬆️',
          fix: '🐛',
          note: '📝',
          breaking: '⚠️',
          deprecated: '🗑️',
        }[change.type] || '•';
        markdown += `- ${typeEmoji} **${change.type.charAt(0).toUpperCase() + change.type.slice(1)}:** ${change.text}\n`;
      });
      markdown += '\n---\n\n';
    });

    // Download as file
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CHANGELOG.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast.success('Changelog exported!');
  };

  // Copy single changelog as markdown
  const handleCopyMarkdown = async (changelog) => {
    const date = formatDate(changelog.date);
    
    let markdown = `## [${changelog.version}] - ${date}\n\n`;
    markdown += `### ${changelog.title}\n\n`;
    
    if (changelog.description) {
      markdown += `${changelog.description}\n\n`;
    }
    
    changelog.changes.forEach(change => {
      const typeEmoji = {
        feature: '✨',
        improvement: '⬆️',
        fix: '🐛',
        note: '📝',
        breaking: '⚠️',
        deprecated: '🗑️',
      }[change.type] || '•';
      markdown += `- ${typeEmoji} **${change.type.charAt(0).toUpperCase() + change.type.slice(1)}:** ${change.text}\n`;
    });

    try {
      await navigator.clipboard.writeText(markdown);
      showToast.success('Copied to clipboard!');
    } catch {
      showToast.error('Failed to copy');
    }
  };

  // Bulk selection helpers
  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAllVisible = () => {
    const visibleIds = filteredChangelogs.map(c => c._id);
    setSelectedIds(visibleIds);
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  // Bulk delete selected
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    const confirmed = await confirm({
      title: 'Delete Selected Changelogs',
      message: `Are you sure you want to delete ${selectedIds.length} changelog(s)? This cannot be undone.`,
      confirmText: `Delete ${selectedIds.length}`,
      type: 'danger',
    });

    if (!confirmed) return;

    try {
      // Use bulk delete endpoint (single request instead of N requests)
      const { data } = await api.delete('/changelog/admin/bulk', { data: { ids: selectedIds } });
      showToast.success(data.message || `Deleted ${selectedIds.length} changelog(s)`);
      setSelectedIds([]);
      fetchChangelogs();
    } catch {
      showToast.error('Failed to delete changelogs');
    }
  };

  // Bulk publish/unpublish selected
  const handleBulkPublish = async (publish) => {
    if (selectedIds.length === 0) return;

    const action = publish ? 'publish' : 'unpublish';
    const confirmed = await confirm({
      title: `${publish ? 'Publish' : 'Unpublish'} Selected`,
      message: `Are you sure you want to ${action} ${selectedIds.length} changelog(s)?`,
      confirmText: `${publish ? 'Publish' : 'Unpublish'} ${selectedIds.length}`,
      type: 'info',
    });

    if (!confirmed) return;

    try {
      // Use bulk publish endpoint (single request instead of N requests)
      const { data } = await api.patch('/changelog/admin/bulk/publish', { 
        ids: selectedIds, 
        publish 
      });
      showToast.success(data.message || `${publish ? 'Published' : 'Unpublished'} changelog(s)`);
      setSelectedIds([]);
      fetchChangelogs();
    } catch {
      showToast.error(`Failed to ${action} changelogs`);
    }
  };

  // Duplicate changelog
  const handleDuplicate = async (id) => {
    try {
      await api.post(`/changelog/admin/${id}/duplicate`);
      showToast.success('Changelog duplicated');
      fetchChangelogs();
      fetchSuggestedVersion();
    } catch {
      showToast.error('Failed to duplicate');
    }
  };

  // Add change
  const addChange = () => {
    setForm(prev => ({
      ...prev,
      changes: [...prev.changes, { type: 'feature', text: '' }],
    }));
  };

  // Remove change
  const removeChange = (index) => {
    if (form.changes.length <= 1) return;
    setForm(prev => ({
      ...prev,
      changes: prev.changes.filter((_, i) => i !== index),
    }));
  };

  // Update change
  const updateChange = (index, field, value) => {
    setForm(prev => ({
      ...prev,
      changes: prev.changes.map((c, i) => 
        i === index ? { ...c, [field]: value } : c
      ),
    }));
  };

  // Filter changelogs based on search and filter
  const filteredChangelogs = changelogs.filter(changelog => {
    // Apply search filter
    const matchesSearch = searchQuery === '' || 
      changelog.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
      changelog.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Apply type filter
    const matchesFilter = filterType === 'all' ||
      (filterType === 'published' && changelog.isPublished) ||
      (filterType === 'draft' && !changelog.isPublished);
    
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Changelog Manager</h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New Release
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by version or title..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
        >
          <option value="all">All ({changelogs.length})</option>
          <option value="published">Published ({changelogs.filter(c => c.isPublished).length})</option>
          <option value="draft">Drafts ({changelogs.filter(c => !c.isPublished).length})</option>
        </select>
        <button
          onClick={handleExportMarkdown}
          disabled={changelogs.filter(c => c.isPublished).length === 0}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-gray-300 hover:bg-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          title="Export published changelogs to Markdown"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl">
          <span className="text-sm text-purple-300 font-medium">
            {selectedIds.length} selected
          </span>
          <div className="h-4 w-px bg-purple-500/30" />
          <button
            onClick={selectAllVisible}
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            Select All ({filteredChangelogs.length})
          </button>
          <button
            onClick={deselectAll}
            className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            Deselect
          </button>
          <div className="flex-1" />
          <button
            onClick={() => handleBulkPublish(true)}
            className="px-3 py-1.5 text-sm bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors"
          >
            Publish
          </button>
          <button
            onClick={() => handleBulkPublish(false)}
            className="px-3 py-1.5 text-sm bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-lg hover:bg-gray-500/30 transition-colors"
          >
            Unpublish
          </button>
          <button
            onClick={handleBulkDelete}
            className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            Delete
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && createPortal(
        <div 
          className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 pt-4 sm:pt-4 overflow-y-auto overscroll-none touch-pan-y"
          onClick={(e) => e.target === e.currentTarget && (setShowForm(false), resetForm())}
        >
          <div ref={formModalRef} className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90dvh] sm:max-h-[85vh] overflow-hidden flex flex-col shadow-2xl my-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {editingId ? 'Edit Release' : 'New Release'}
              </h3>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            {/* Content continues... */}

            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 overflow-y-auto overscroll-none flex-1 min-h-0">
              {/* Version & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Version *</label>
                  <input
                    type="text"
                    value={form.version}
                    onChange={(e) => setForm(prev => ({ ...prev, version: e.target.value }))}
                    placeholder="e.g., 1.0.0 or 1.0.0-beta"
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Major Performance Update 🚀"
                  maxLength={100}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Description (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Description (Optional)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief summary of this release..."
                  maxLength={500}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              {/* Type & Icon */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Release Type</label>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(releaseTypeGradients).map(([type, gradient]) => (
                      <button
                        key={type}
                        onClick={() => setForm(prev => ({ ...prev, type }))}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          form.type === type
                            ? `bg-gradient-to-r ${gradient} text-white`
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Icon</label>
                  <div className="flex gap-1 flex-wrap">
                    {Object.entries(iconMap).map(([name, iconData]) => {
                      const IconComp = iconData.icon;
                      return (
                        <button
                          key={name}
                          onClick={() => setForm(prev => ({ ...prev, icon: name }))}
                          className={`p-2 rounded-lg transition-all ${
                            form.icon === name
                              ? 'bg-purple-500/30 ring-2 ring-purple-500'
                              : 'bg-gray-800 hover:bg-gray-700'
                          }`}
                        >
                          <IconComp className={`w-4 h-4 ${iconData.color}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Changes */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Changes *</label>
                <div className="space-y-2">
                  {form.changes.map((change, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-2 bg-gray-800/50 p-2 rounded-xl sm:bg-transparent sm:p-0">
                      <div className="flex gap-2 w-full sm:w-auto">
                         <select
                          value={change.type}
                          onChange={(e) => updateChange(index, 'type', e.target.value)}
                          className="flex-1 sm:w-auto px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                        >
                          {Object.entries(changeTypeStyles).map(([type, style]) => (
                            <option key={type} value={type}>
                              {style.label}
                            </option>
                          ))}
                        </select>
                        {/* Mobile Delete Button (visible only on small) */}
                        <button
                          onClick={() => removeChange(index)}
                          disabled={form.changes.length <= 1}
                          className="sm:hidden p-2 text-gray-500 hover:text-red-400 disabled:opacity-30 transition-colors bg-gray-800 border border-gray-700 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={change.text}
                          onChange={(e) => updateChange(index, 'text', e.target.value)}
                          placeholder="Describe the change..."
                          maxLength={200}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 pr-12"
                        />
                        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${change.text.length > 180 ? 'text-amber-400' : 'text-gray-500'}`}>
                          {change.text.length}
                        </span>
                      </div>
                      
                      {/* Desktop Delete Button */}
                      <button
                        onClick={() => removeChange(index)}
                        disabled={form.changes.length <= 1}
                        className="hidden sm:block p-2 text-gray-500 hover:text-red-400 disabled:opacity-30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addChange}
                  className="mt-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                >
                  + Add Change
                </button>
              </div>

              {/* Publish Toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setForm(prev => ({ ...prev, isPublished: !prev.isPublished, scheduledFor: '' }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    form.isPublished ? 'bg-green-500' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      form.isPublished ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-400">
                  {form.isPublished ? 'Published (visible to users)' : 'Draft (hidden from users)'}
                </span>
              </div>

              {/* Scheduled Publishing */}
              {!form.isPublished && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <label className="block text-sm font-medium text-blue-400 mb-2">⏰ Schedule Publish</label>
                  <input
                    type="datetime-local"
                    value={form.scheduledFor}
                    min={toInputDateTime(new Date())}
                    onChange={(e) => setForm(prev => ({ ...prev, scheduledFor: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                  {form.scheduledFor && (
                    <p className="text-xs text-blue-300 mt-2">
                      Will auto-publish on {formatDateTime(form.scheduledFor)}
                    </p>
                  )}
                </div>
              )}

              {/* Roadmap Section - Only for drafts */}
              {!form.isPublished && (
                <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-purple-400 flex items-center gap-2">
                      🚀 Show on Public Roadmap
                    </label>
                    <button
                      onClick={() => setForm(prev => ({ ...prev, showOnRoadmap: !prev.showOnRoadmap }))}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        form.showOnRoadmap ? 'bg-purple-500' : 'bg-gray-700'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          form.showOnRoadmap ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </div>
                  
                  {form.showOnRoadmap && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Status</label>
                          <select
                            value={form.roadmapStatus}
                            onChange={(e) => setForm(prev => ({ ...prev, roadmapStatus: e.target.value }))}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 text-sm"
                          >
                            <option value="idea">💡 Idea</option>
                            <option value="planned">🎯 Planned</option>
                            <option value="in-progress">🚧 In Progress</option>
                            <option value="testing">🧪 Testing</option>
                            <option value="coming-soon">🚀 Coming Soon</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Estimated Release</label>
                          <input
                            type="text"
                            value={form.estimatedRelease}
                            onChange={(e) => setForm(prev => ({ ...prev, estimatedRelease: e.target.value }))}
                            placeholder="e.g., Q1 2026, January"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <label>Priority</label>
                          <span className="font-mono text-purple-400">
                            {form.roadmapPriority < 30 ? 'Low' : 
                             form.roadmapPriority < 70 ? 'Medium' : 'High'} ({form.roadmapPriority})
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={form.roadmapPriority}
                          onChange={(e) => setForm(prev => ({ ...prev, roadmapPriority: parseInt(e.target.value) }))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                          <span>Low</span>
                          <span>Medium</span>
                          <span>High</span>
                        </div>
                      </div>
                      <p className="text-xs text-purple-300/70">
                        When published, this will be removed from the roadmap and appear in the changelog.
                      </p>
                    </>
                  )}
                </div>
              )}

            </div>
            
            {/* Sticky Actions Footer */}
            <div className="p-3 sm:p-4 border-t border-gray-700 bg-gray-900 shrink-0">
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowForm(false); resetForm(); }}
                className="flex-1 py-2.5 sm:py-3 bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors font-medium border border-gray-700 text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 sm:py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg text-sm sm:text-base"
                >
                  {saving && <Loader2 className="w-5 h-5 animate-spin" />}
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Changelog List */}
      {changelogs.length === 0 ? (
        <div className="text-center py-12 bg-gray-900/50 rounded-2xl border border-gray-800">
          <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No releases yet</h3>
          <p className="text-gray-400 mb-4">Create your first changelog entry</p>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors"
          >
            Create First Release
          </button>
        </div>
      ) : filteredChangelogs.length === 0 ? (
        <div className="text-center py-12 bg-gray-900/50 rounded-2xl border border-gray-800">
          <svg className="w-12 h-12 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="text-lg font-medium text-white mb-2">No results found</h3>
          <p className="text-gray-400 mb-4">Try adjusting your search or filter</p>
          <button
            onClick={() => { setSearchQuery(''); setFilterType('all'); }}
            className="px-4 py-2 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredChangelogs.map((changelog) => {
            const IconComponent = iconMap[changelog.icon]?.icon || Star;
            
            return (
              <div
                key={changelog._id}
                className={`bg-gray-900/50 border rounded-2xl p-4 transition-all ${
                  changelog.isPublished 
                    ? 'border-gray-700 hover:border-gray-600' 
                    : 'border-amber-500/30 bg-amber-500/5'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0 w-full">
                    {/* Checkbox for bulk selection */}
                    <label className="flex items-center cursor-pointer mt-0.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(changelog._id)}
                        onChange={() => toggleSelect(changelog._id)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                      />
                    </label>
                    <div className={`p-2 rounded-xl bg-gradient-to-r ${releaseTypeGradients[changelog.type]}`}>
                      <IconComponent className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r ${releaseTypeGradients[changelog.type]} text-white`}>
                          v{changelog.version}
                        </span>
                        <span className="text-gray-500 text-sm">
                          {formatDate(changelog.date)}
                        </span>
                        {!changelog.isPublished && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Draft
                          </span>
                        )}
                        {changelog.scheduledFor && !changelog.isPublished && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30" title={`Scheduled: ${formatDateTime(changelog.scheduledFor)}`}>
                            ⏰ {formatDate(changelog.scheduledFor)}
                          </span>
                        )}
                      </div>
                      <h3 className="text-white font-semibold mt-1 truncate">{changelog.title}</h3>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {changelog.changes.slice(0, 3).map((change, idx) => (
                          <span 
                            key={idx} 
                            className={`px-2 py-0.5 text-xs rounded ${changeTypeStyles[change.type]?.bg} ${changeTypeStyles[change.type]?.text}`}
                          >
                            {changeTypeStyles[change.type]?.label}
                          </span>
                        ))}
                        {changelog.changes.length > 3 && (
                          <span className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-400">
                            +{changelog.changes.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between sm:justify-start gap-1 w-full sm:w-auto mt-2 sm:mt-0 border-t border-white/5 sm:border-0 pt-3 sm:pt-0">
                    <button
                      onClick={() => handleTogglePublish(changelog._id)}
                      className={`p-2 rounded-lg transition-colors ${
                        changelog.isPublished 
                          ? 'text-green-400 hover:bg-green-500/20' 
                          : 'text-gray-500 hover:bg-gray-700'
                      }`}
                      title={changelog.isPublished ? 'Unpublish' : 'Publish'}
                    >
                      {changelog.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDuplicate(changelog._id)}
                      className="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCopyMarkdown(changelog)}
                      className="p-2 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors"
                      title="Copy as Markdown"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                    {changelog.history && changelog.history.length > 0 && (
                      <button
                        onClick={() => setHistoryModal(changelog)}
                        className="p-2 text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition-colors"
                        title="View History"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(changelog)}
                      className="p-2 text-gray-500 hover:text-purple-400 hover:bg-purple-500/20 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(changelog._id)}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History Modal */}
      {historyModal && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-[95%] max-w-md max-h-[90dvh] overflow-hidden flex flex-col overscroll-contain">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-bold text-white">History - v{historyModal.version}</h3>
              <button
                onClick={() => setHistoryModal(null)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
              {historyModal.history && historyModal.history.length > 0 ? (
                <div className="space-y-3">
                  {historyModal.history.slice().reverse().map((entry, idx) => (
                    <div key={idx} className="flex gap-3 p-3 bg-gray-800/50 rounded-lg">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        entry.action === 'created' ? 'bg-green-500/20 text-green-400' :
                        entry.action === 'published' ? 'bg-blue-500/20 text-blue-400' :
                        entry.action === 'unpublished' ? 'bg-amber-500/20 text-amber-400' :
                        entry.action === 'duplicated' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {entry.action === 'created' && '✨'}
                        {entry.action === 'published' && '👁️'}
                        {entry.action === 'unpublished' && '👁️‍🗨️'}
                        {entry.action === 'updated' && '✏️'}
                        {entry.action === 'duplicated' && '📋'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium capitalize">{entry.action}</p>
                        <p className="text-gray-500 text-xs">
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                        {entry.changes && entry.changes !== 'null' && (
                          <p className="text-gray-400 text-sm mt-1 break-all">{entry.changes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No history available</p>
              )}
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default ChangelogManager;

