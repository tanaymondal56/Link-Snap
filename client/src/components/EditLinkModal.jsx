import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Link as LinkIcon,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  Edit3,
} from 'lucide-react';
import api from '../api/axios';
import showToast from '../components/ui/Toast';
import { getShortUrl } from '../utils/urlHelper';

// Helper to normalize URL (add https:// if missing)
const normalizeUrl = (input) => {
  if (!input) return '';
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

// Simple URL validation regex
const isValidUrl = (input) => {
  if (!input) return false;
  const normalized = normalizeUrl(input);
  return /^https?:\/\/[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+/.test(normalized);
};

// Debounce hook
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

// Get base domain from getShortUrl helper
const getBaseDomain = () => {
  const fullUrl = getShortUrl('');
  return fullUrl.replace(/\/$/, '');
};

const EditLinkModal = ({ isOpen, onClose, onSuccess, link }) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Alias availability state
  const [aliasStatus, setAliasStatus] = useState({
    checking: false,
    available: null,
    reason: null,
  });

  const debouncedAlias = useDebounce(customAlias, 400);
  const baseDomain = getBaseDomain();

  // Initialize form with link data
  useEffect(() => {
    if (link && isOpen) {
      setUrl(link.originalUrl || '');
      setTitle(link.title || '');
      setCustomAlias(link.customAlias || '');
      setAliasStatus({ checking: false, available: null, reason: null });
    }
  }, [link, isOpen]);

  // Check alias availability
  const checkAlias = useCallback(
    async (alias) => {
      if (!alias || alias.length < 3) {
        setAliasStatus({ checking: false, available: null, reason: null });
        return;
      }

      // If alias hasn't changed from original, it's valid
      if (link?.customAlias === alias) {
        setAliasStatus({ checking: false, available: true, reason: null });
        return;
      }

      setAliasStatus({ checking: true, available: null, reason: null });

      try {
        const { data } = await api.get(
          `/url/check-alias/${encodeURIComponent(alias)}?excludeId=${link._id}`
        );
        setAliasStatus({
          checking: false,
          available: data.available,
          reason: data.reason,
        });
      } catch {
        setAliasStatus({
          checking: false,
          available: false,
          reason: 'Failed to check availability',
        });
      }
    },
    [link]
  );

  // Trigger check when debounced alias changes
  useEffect(() => {
    if (debouncedAlias && isOpen) {
      checkAlias(debouncedAlias);
    } else if (!debouncedAlias) {
      setAliasStatus({ checking: false, available: null, reason: null });
    }
  }, [debouncedAlias, checkAlias, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!url) return;

    if (!isValidUrl(url)) {
      return;
    }

    // If custom alias is provided and changed, check if it's available
    if (customAlias && customAlias !== link?.customAlias && aliasStatus.available === false) {
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        originalUrl: normalizeUrl(url),
        title: title || undefined,
      };

      // Handle custom alias: send empty string to remove, or the new value
      if (customAlias && customAlias.length >= 3) {
        payload.customAlias = customAlias;
      } else if (link?.customAlias && !customAlias) {
        // User cleared the alias - send null to remove it
        payload.customAlias = null;
      }

      const { data } = await api.put(`/url/${link._id}`, payload);
      onSuccess(data);
      onClose();
    } catch (error) {
      showToast.error(error.response?.data?.message || 'Failed to update link');
      console.error('Failed to update link:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle alias input - only allow valid characters
  const handleAliasChange = (e) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
    setCustomAlias(value.slice(0, 20));
  };

  if (!isOpen || !link) return null;

  const getAliasStatusIcon = () => {
    if (aliasStatus.checking) {
      return <Loader2 className="animate-spin text-gray-400" size={18} />;
    }
    if (aliasStatus.available === true) {
      return <Check className="text-green-400" size={18} />;
    }
    if (aliasStatus.available === false) {
      return <AlertCircle className="text-red-400" size={18} />;
    }
    return null;
  };

  const getAliasInputBorderColor = () => {
    if (customAlias.length === 0) return 'border-gray-700 focus:border-purple-500';
    if (aliasStatus.checking) return 'border-gray-600';
    if (aliasStatus.available === true) return 'border-green-500';
    if (aliasStatus.available === false) return 'border-red-500';
    return 'border-gray-700';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-gray-900/95 border border-gray-700/50 rounded-2xl shadow-2xl animate-modal-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Edit3 size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Edit Link</h2>
              <p className="text-sm text-gray-400">
                Original: <span className="text-blue-400">/{link.shortId}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700/50 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Destination URL <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="https://example.com/very-long-url-here"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className={`w-full bg-gray-800/50 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors ${
                  url && isValidUrl(url)
                    ? 'border-green-500'
                    : url && !isValidUrl(url)
                      ? 'border-red-500'
                      : 'border-gray-700 focus:border-blue-500'
                }`}
                required
              />
              {url && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isValidUrl(url) ? (
                    <Check className="text-green-400" size={18} />
                  ) : (
                    <AlertCircle className="text-red-400" size={18} />
                  )}
                </div>
              )}
            </div>
            {url && !isValidUrl(url) && (
              <p className="mt-1.5 text-sm text-red-400">Please enter a valid URL</p>
            )}
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Title <span className="text-xs text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="My awesome link"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              maxLength={100}
            />
          </div>

          {/* Custom Alias Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <span className="flex items-center gap-2">
                Custom Alias
                <span className="text-xs text-gray-500 font-normal">(optional)</span>
                <Sparkles size={14} className="text-purple-400" />
              </span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
                {baseDomain}/
              </span>
              <input
                type="text"
                placeholder="my-brand"
                value={customAlias}
                onChange={handleAliasChange}
                className={`w-full bg-gray-800/50 border rounded-xl pr-10 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors ${getAliasInputBorderColor()}`}
                style={{ paddingLeft: `${baseDomain.length * 7.5 + 20}px` }}
                maxLength={20}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {getAliasStatusIcon()}
              </div>
            </div>

            {/* Alias Status Message */}
            <div className="mt-1.5 flex items-center justify-between">
              <div>
                {customAlias.length > 0 && customAlias.length < 3 && (
                  <p className="text-sm text-gray-500">Minimum 3 characters</p>
                )}
                {aliasStatus.reason && aliasStatus.available === false && (
                  <p className="text-sm text-red-400">{aliasStatus.reason}</p>
                )}
                {aliasStatus.available === true && customAlias !== link.customAlias && (
                  <p className="text-sm text-green-400">✓ This alias is available!</p>
                )}
                {customAlias === link.customAlias && customAlias && (
                  <p className="text-sm text-gray-500">Current alias</p>
                )}
              </div>
              <span className="text-xs text-gray-500">{customAlias.length}/20</span>
            </div>
          </div>

          {/* Info Box - Random ID preserved */}
          <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
            <div className="flex items-start gap-3">
              <LinkIcon size={18} className="text-blue-400 mt-0.5" />
              <div className="text-sm">
                <p className="text-blue-300 font-medium">Original Short ID Preserved</p>
                <p className="text-gray-400 mt-1">
                  Your original link <span className="text-blue-400">/{link.shortId}</span> will
                  always work.
                  {customAlias && customAlias.length >= 3 && (
                    <span>
                      {' '}
                      The custom alias <span className="text-purple-400">/{customAlias}</span> will
                      be an additional way to access this link.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Active Short URLs</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ExternalLink size={16} className="text-gray-400" />
                <span className="text-blue-400 font-mono text-sm">
                  {baseDomain}/{link.shortId}
                </span>
                <span className="text-xs text-gray-500">(original)</span>
              </div>
              {customAlias && customAlias.length >= 3 && (
                <div className="flex items-center gap-2">
                  <ExternalLink size={16} className="text-purple-400" />
                  <span className="text-purple-400 font-mono text-sm">
                    {baseDomain}/{customAlias}
                  </span>
                  <span className="text-xs text-gray-500">(custom)</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSaving ||
                !url ||
                !isValidUrl(url) ||
                (customAlias.length > 0 && customAlias.length < 3) ||
                (customAlias && customAlias !== link.customAlias && aliasStatus.available === false)
              }
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-xl transition-all font-medium"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditLinkModal;
