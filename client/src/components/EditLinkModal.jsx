import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Link as LinkIcon,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  Edit3,
  Clock,
  Lock,
  Eye,
  EyeOff,
  Crown,
  Globe,
  Info,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import api from '../api/axios';
import showToast from '../utils/toastUtils';
import { getDomain } from '../utils/urlHelper';
import { useScrollLock } from '../hooks/useScrollLock';
import { Link } from 'react-router-dom';
import { ProBadge } from './subscription/PremiumField';
import { usePremiumField } from '../hooks/usePremiumField';
import DeviceTargetingSection from './DeviceTargetingSection';
import TimeRoutingSection from './TimeRoutingSection';

// Expiration presets for edit mode (includes 'keep' option)
const EXPIRATION_OPTIONS = [
  { value: 'keep', label: 'Keep current' },
  { value: 'never', label: 'Never expires' },
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'custom', label: 'Custom date & time...' },
];

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

// Check if a datetime-local value is in the past
const isPastDate = (dateTimeString) => {
  if (!dateTimeString) return false;
  return new Date(dateTimeString) <= new Date();
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

// Get base domain from getDomain helper (already without protocol)
const getBaseDomain = () => {
  return getDomain();
};

// Get a truncated display version for long domains
const getDisplayDomain = (domain, maxLength = 20) => {
  if (domain.length <= maxLength) return domain;
  return domain.slice(0, maxLength - 3) + '...';
};

const EditLinkModal = ({ isOpen, onClose, onSuccess, link }) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Expiration state
  const [expiresAction, setExpiresAction] = useState('keep');
  const [customExpiresAt, setCustomExpiresAt] = useState('');

  // Password state
  const [passwordAction, setPasswordAction] = useState('keep');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Schedule Activation (Free feature)
  const [enableSchedule, setEnableSchedule] = useState(false);
  const [activeStartTime, setActiveStartTime] = useState('');

  // Device targeting state
  const [deviceRedirects, setDeviceRedirects] = useState({
    enabled: false,
    rules: [],
  });

  // Time-Based Redirects state (Pro feature)
  const [timeRedirects, setTimeRedirects] = useState({
    enabled: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    rules: [],
  });

  // Alias availability state
  const [aliasStatus, setAliasStatus] = useState({
    checking: false,
    available: null,
    reason: null,
  });

  // Premium field access states
  const aliasField = usePremiumField('custom_alias');
  const expirationField = usePremiumField('link_expiration');
  const passwordField = usePremiumField('password_protection');
  const deviceTargetingField = usePremiumField('device_targeting');
  const timeRedirectsField = usePremiumField('time_redirects');

  const debouncedAlias = useDebounce(customAlias, 400);
  const baseDomain = getBaseDomain();

  // Tab state
  const [activeTab, setActiveTab] = useState('essentials');

  // Scroll indicator state (content)
  const scrollContainerRef = useRef(null);
  const [showTopArrow, setShowTopArrow] = useState(false);
  const [showBottomArrow, setShowBottomArrow] = useState(false);

  // Tab scroll state (horizontal tabs)
  const tabsRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Check tab scroll position
  const checkTabScroll = useCallback(() => {
    const tabsEl = tabsRef.current;
    if (!tabsEl) return;
    const { scrollLeft, scrollWidth, clientWidth } = tabsEl;
    setShowLeftArrow(scrollLeft > 10);
    setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 10);
  }, []);

  // Check on mount and resize
  useEffect(() => {
    checkTabScroll();
    window.addEventListener('resize', checkTabScroll);
    return () => window.removeEventListener('resize', checkTabScroll);
  }, [checkTabScroll]);

  // Check content scroll position
  const checkScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    setShowTopArrow(scrollTop > 20);
    setShowBottomArrow(scrollTop + clientHeight < scrollHeight - 20);
  }, []);

  // Check scroll when tab changes
  useEffect(() => {
    setTimeout(checkScroll, 100);
  }, [activeTab, checkScroll]);

  // Calculate badges/indicators
  const settingsActive =
    (expiresAction !== 'keep' && expiresAction !== '') ||
    passwordAction !== 'keep' ||
    enableSchedule;
  const targetingActive =
    (deviceRedirects.enabled && deviceRedirects.rules.length > 0) ||
    (timeRedirects.enabled && timeRedirects.rules.length > 0);

  // Scroll Lock
  useScrollLock(isOpen);

  // Initialize form with link data
  useEffect(() => {
    if (link && isOpen) {
      setUrl(link.originalUrl || '');
      setTitle(link.title || '');
      setCustomAlias(link.customAlias || '');
      setExpiresAction('keep');
      setCustomExpiresAt('');
      setPasswordAction('keep');
      setPassword('');
      setShowPassword(false);

      // Schedule Activation
      if (link.activeStartTime && new Date(link.activeStartTime) > new Date()) {
        setEnableSchedule(true);
        setActiveStartTime(new Date(link.activeStartTime).toISOString().slice(0, 16));
      } else {
        setEnableSchedule(false);
        setActiveStartTime('');
      }

      // Device redirects
      setDeviceRedirects(link.deviceRedirects || { enabled: false, rules: [] });

      // Time redirects
      setTimeRedirects(
        link.timeRedirects || {
          enabled: false,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          rules: [],
        }
      );

      setAliasStatus({ checking: false, available: null, reason: null });
      setActiveTab('essentials');
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
    if (e) e.preventDefault();

    if (!url) return;

    if (!isValidUrl(url)) {
      return;
    }

    // If custom alias is provided and changed, check if it's available
    if (customAlias && customAlias !== link?.customAlias && aliasStatus.available === false) {
      return;
    }

    // Validate password if setting new
    if (passwordAction === 'set' && password.length < 4) {
      showToast.error('Password must be at least 4 characters');
      setActiveTab('settings');
      return;
    }

    // Validate schedule time
    if (enableSchedule && activeStartTime && isPastDate(activeStartTime)) {
      showToast.error('Schedule time must be in the future');
      setActiveTab('settings');
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        originalUrl: normalizeUrl(url),
        title: title || undefined,
      };

      // Handle custom alias (Pro feature) - only if user has access
      if (!aliasField.isLocked) {
        if (customAlias && customAlias.length >= 3) {
          payload.customAlias = customAlias;
        } else if (link?.customAlias && !customAlias) {
          payload.customAlias = null; // Remove alias
        }
      }

      // Handle expiration (Pro feature) - only if user has access
      if (!expirationField.isLocked) {
        if (expiresAction === 'never') {
          payload.removeExpiration = true;
        } else if (expiresAction === 'custom' && customExpiresAt) {
          payload.expiresAt = new Date(customExpiresAt).toISOString();
        } else if (expiresAction !== 'keep' && expiresAction !== 'custom') {
          payload.expiresIn = expiresAction;
        }
      }

      // Handle password (Pro feature) - only if user has access
      if (!passwordField.isLocked) {
        if (passwordAction === 'remove') {
          payload.removePassword = true;
        } else if (passwordAction === 'set' && password.length >= 4) {
          payload.password = password;
        }
      }

      // Handle device redirects (Pro feature) - only if user has access
      if (!deviceTargetingField.isLocked) {
        payload.deviceRedirects = {
          enabled: deviceRedirects.enabled,
          rules: deviceRedirects.rules
            .filter((r) => r.url && r.url.trim() !== '')
            .map((r) => ({ ...r, url: normalizeUrl(r.url) })),
        };
      }

      // Handle Schedule Activation (Free feature)
      if (enableSchedule && activeStartTime) {
        payload.activeStartTime = new Date(activeStartTime).toISOString();
      } else if (!enableSchedule && link.activeStartTime) {
        payload.removeActiveStartTime = true;
      }

      // Handle Time Routing (Pro feature) - only if user has access
      if (!timeRedirectsField.isLocked) {
        if (timeRedirects.enabled && timeRedirects.rules.length > 0) {
          payload.timeRedirects = {
            enabled: true,
            timezone: timeRedirects.timezone,
            rules: timeRedirects.rules
              .filter((r) => r.destination && r.startTime && r.endTime)
              .map((r) => ({ ...r, destination: normalizeUrl(r.destination) })),
          };
        } else {
          payload.timeRedirects = { enabled: false, rules: [] };
        }
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-gray-900/80">
      <div
        data-modal-content
        className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-xl max-h-[90dvh] flex flex-col overflow-hidden overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Edit3 size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                Edit Link
              </h2>
              <p className="text-sm text-gray-400">
                Original: <span className="text-blue-400 font-mono">/{link.shortId}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs with Bidirectional Scroll Indicators */}
        <div className="relative shrink-0">
          {/* Left scroll indicator */}
          {showLeftArrow && (
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-gray-900 via-gray-900/90 to-transparent pointer-events-none z-10 sm:hidden flex items-center justify-start pl-1">
              <ChevronLeft size={18} className="text-blue-400" strokeWidth={3} />
            </div>
          )}

          <div
            ref={tabsRef}
            onScroll={checkTabScroll}
            className="flex p-2 gap-2 border-b border-gray-800 bg-gray-900/50 overflow-x-auto scrollbar-hide"
          >
            <button
              onClick={() => setActiveTab('essentials')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'essentials'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              <LinkIcon size={16} />
              Essentials
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              <div className="relative">
                <Lock size={16} />
                {settingsActive && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-gray-900" />
                )}
              </div>
              Settings
            </button>

            <button
              onClick={() => setActiveTab('targeting')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === 'targeting'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              <div className="relative">
                <Globe size={16} />
                {targetingActive && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-gray-900" />
                )}
              </div>
              Targeting
              <ProBadge className="ml-1 scale-75" />
            </button>
          </div>

          {/* Right scroll indicator */}
          {showRightArrow && (
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-900 via-gray-900/90 to-transparent pointer-events-none z-10 sm:hidden flex items-center justify-end pr-1">
              <ChevronRight size={18} className="text-blue-400" strokeWidth={3} />
            </div>
          )}
        </div>

        {/* Scrollable Content with Scroll Indicators */}
        <div className="relative flex-1 min-h-0">
          {/* Top Scroll Indicator */}
          {showTopArrow && (
            <div className="absolute top-0 left-0 right-0 z-10 flex justify-center pointer-events-none">
              <div className="bg-gradient-to-b from-gray-900 via-gray-900/90 to-transparent px-4 py-2 flex items-center gap-1 text-gray-400">
                <ChevronUp size={16} className="animate-bounce" />
                <span className="text-xs">Scroll up</span>
              </div>
            </div>
          )}

          <div
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="overflow-y-auto p-6 pb-8 space-y-6 custom-scrollbar h-full max-h-[calc(90vh-250px)]"
          >
            {/* TAB 1: ESSENTIALS */}
            <div className={activeTab === 'essentials' ? 'space-y-6' : 'hidden'}>
              {/* Destination URL */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Destination URL <span className="text-red-400">*</span>
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/long-url"
                    className={`w-full bg-gray-800/50 border rounded-xl px-4 py-3 pl-11 text-white placeholder-gray-500 focus:outline-none transition-all ${
                      url && isValidUrl(url)
                        ? 'border-green-500'
                        : url && !isValidUrl(url)
                          ? 'border-red-500'
                          : 'border-gray-700 focus:border-blue-500'
                    }`}
                  />
                  <LinkIcon
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-hover:text-blue-400 transition-colors"
                    size={18}
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
              </div>

              {/* Title */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Title <span className="text-xs text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My awesome link"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                  maxLength={100}
                />
              </div>

              {/* Custom Alias */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Sparkles size={16} className="text-purple-400" />
                  Custom Link
                  <Crown size={14} className="text-amber-400" />
                </label>

                {aliasField.isLocked ? (
                  <div className="relative group overflow-hidden rounded-xl border border-gray-700 bg-gray-800/30 p-4 transition-all hover:border-orange-500/30">
                    <div className="flex items-center justify-between relative z-10">
                      <div>
                        <h4 className="font-medium text-gray-300 mb-1">Upgrade to customize</h4>
                        <p className="text-sm text-gray-500">
                          Create branded links with custom back-halves.
                        </p>
                      </div>
                      <Link
                        to={aliasField.upgradePath}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-amber-500/30 transition-all"
                      >
                        <Crown size={16} />
                        {aliasField.upgradeText}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex items-center">
                      <span
                        className="hidden sm:flex items-center px-3 py-3 bg-gray-800/50 border border-r-0 border-gray-700 rounded-l-xl text-gray-400 text-sm max-w-[180px]"
                        title={`${baseDomain}/`}
                      >
                        <span className="truncate">{getDisplayDomain(baseDomain, 18)}</span>/
                      </span>
                      <input
                        type="text"
                        value={customAlias}
                        onChange={handleAliasChange}
                        onBlur={() => checkAlias(customAlias)}
                        placeholder="custom-alias"
                        className={`flex-1 bg-gray-800/30 border sm:rounded-l-none rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-all ${
                          customAlias.length === 0
                            ? 'border-gray-700 focus:border-purple-500'
                            : aliasStatus.checking
                              ? 'border-gray-600'
                              : aliasStatus.available === true
                                ? 'border-green-500'
                                : aliasStatus.available === false
                                  ? 'border-red-500'
                                  : 'border-gray-700'
                        }`}
                        maxLength={20}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {aliasStatus.checking ? (
                          <Loader2 size={16} className="animate-spin text-gray-400" />
                        ) : (
                          customAlias &&
                          customAlias.length >= 3 &&
                          (aliasStatus.available ? (
                            <Check size={16} className="text-green-500" />
                          ) : aliasStatus.available === false ? (
                            <X size={16} className="text-red-500" />
                          ) : null)
                        )}
                      </div>
                    </div>
                    {customAlias &&
                      customAlias.length >= 3 &&
                      !aliasStatus.checking &&
                      !aliasStatus.available &&
                      aliasStatus.reason && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
                          <AlertCircle size={12} />
                          {aliasStatus.reason}
                        </div>
                      )}
                    {customAlias === link.customAlias && customAlias && (
                      <p className="mt-1.5 text-xs text-gray-500">Current alias</p>
                    )}
                  </div>
                )}
              </div>

              {/* Info Box - Short URLs Preview */}
              <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                <div className="flex items-start gap-3">
                  <Info size={18} className="text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-sm min-w-0 flex-1">
                    <p className="text-blue-300 font-medium">Active Short URLs</p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <ExternalLink size={14} className="text-blue-400 shrink-0" />
                        <span
                          className="text-blue-400 font-mono text-xs truncate"
                          title={`${baseDomain}/${link.shortId}`}
                        >
                          {getDisplayDomain(baseDomain, 15)}/{link.shortId}
                        </span>
                        <span className="text-xs text-gray-500 shrink-0">(original)</span>
                      </div>
                      {customAlias && customAlias.length >= 3 && (
                        <div className="flex items-center gap-2">
                          <ExternalLink size={14} className="text-purple-400 shrink-0" />
                          <span
                            className="text-purple-400 font-mono text-xs truncate"
                            title={`${baseDomain}/${customAlias}`}
                          >
                            {getDisplayDomain(baseDomain, 15)}/{customAlias}
                          </span>
                          <span className="text-xs text-gray-500 shrink-0">(custom)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TAB 2: SETTINGS */}
            <div className={activeTab === 'settings' ? 'space-y-6' : 'hidden'}>
              {/* Schedule Activation (Free) */}
              <div className="p-4 rounded-xl bg-gray-800/20 border border-gray-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Clock size={18} className="text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white">Schedule Activation</h3>
                      <p className="text-xs text-gray-400">Link goes live at a specific time</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableSchedule}
                      onChange={(e) => setEnableSchedule(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {enableSchedule && (
                  <div className="mt-4 pt-4 border-t border-gray-700/50 animate-in slide-in-from-top-2">
                    <label className="block text-sm text-gray-400 mb-2">
                      Start Time (Your Local Time)
                    </label>
                    <input
                      type="datetime-local"
                      value={activeStartTime}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value && isPastDate(value)) {
                          showToast.error('Please select a future date and time');
                          return;
                        }
                        setActiveStartTime(value);
                      }}
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm"
                    />
                    {activeStartTime && (
                      <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
                        <p className="font-medium mb-1">Schedule Summary:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-y-1 gap-x-4">
                          <span className="text-blue-200/60">Local:</span>
                          <span>{new Date(activeStartTime).toLocaleString()}</span>
                          <span className="text-blue-200/60">UTC:</span>
                          <span className="font-mono">
                            {new Date(activeStartTime).toISOString().slice(0, 16).replace('T', ' ')}{' '}
                            UTC
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Expiration */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Clock size={16} className="text-orange-400" />
                  Link Expiration
                  <Crown size={14} className="text-amber-400" />
                </label>

                {/* Current status */}
                <p className="text-xs text-gray-500">
                  Current:{' '}
                  {link.expiresAt ? (
                    new Date() > new Date(link.expiresAt) ? (
                      <span className="text-red-400">Expired</span>
                    ) : (
                      <span className="text-amber-400">
                        Expires {new Date(link.expiresAt).toLocaleString()}
                      </span>
                    )
                  ) : (
                    'Never expires'
                  )}
                </p>

                {expirationField.isLocked ? (
                  <div className="relative group overflow-hidden rounded-xl border border-gray-700 bg-gray-800/30 p-4 transition-all hover:border-orange-500/30">
                    <div className="flex items-center justify-between relative z-10">
                      <div>
                        <h4 className="font-medium text-gray-300 mb-1">Upgrade to set Expiry</h4>
                        <p className="text-sm text-gray-500">Auto-delete links after a set time.</p>
                      </div>
                      <Link
                        to={expirationField.upgradePath}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-amber-500/30 transition-all"
                      >
                        <Crown size={16} />
                        {expirationField.upgradeText}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {EXPIRATION_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setExpiresAction(option.value);
                            if (option.value !== 'custom') setCustomExpiresAt('');
                          }}
                          className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                            expiresAction === option.value
                              ? 'bg-orange-500/10 text-orange-400 border-orange-500/50'
                              : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-gray-300'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    {expiresAction === 'custom' && (
                      <input
                        type="datetime-local"
                        value={customExpiresAt}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value && isPastDate(value)) {
                            showToast.error('Expiration date must be in the future');
                            return;
                          }
                          setCustomExpiresAt(value);
                        }}
                        min={new Date().toISOString().slice(0, 16)}
                        className="w-full mt-2 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                      />
                    )}
                  </>
                )}
              </div>

              {/* Password Protection */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Lock size={16} className="text-purple-400" />
                  Password Protection
                  <Crown size={14} className="text-amber-400" />
                </label>

                {/* Current status */}
                <p className="text-xs text-gray-500">
                  Current:{' '}
                  {link.isPasswordProtected ? (
                    <span className="text-purple-400">Password protected 🔒</span>
                  ) : (
                    'Not protected'
                  )}
                </p>

                {passwordField.isLocked ? (
                  <div className="relative group overflow-hidden rounded-xl border border-gray-700 bg-gray-800/30 p-4 transition-all hover:border-purple-500/30">
                    <div className="flex items-center justify-between relative z-10">
                      <div>
                        <h4 className="font-medium text-gray-300 mb-1">Upgrade to set Password</h4>
                        <p className="text-sm text-gray-500">
                          Secure your links from unauthorized access.
                        </p>
                      </div>
                      <Link
                        to={passwordField.upgradePath}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-amber-500/30 transition-all"
                      >
                        <Crown size={16} />
                        {passwordField.upgradeText}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordAction('keep');
                          setPassword('');
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          passwordAction === 'keep'
                            ? 'bg-gray-700 text-white'
                            : 'bg-gray-800/50 text-gray-400 hover:text-white'
                        }`}
                      >
                        Keep current
                      </button>
                      <button
                        type="button"
                        onClick={() => setPasswordAction('set')}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          passwordAction === 'set'
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-800/50 text-gray-400 hover:text-white'
                        }`}
                      >
                        {link.isPasswordProtected ? 'Change password' : 'Add password'}
                      </button>
                      {link.isPasswordProtected && (
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordAction('remove');
                            setPassword('');
                          }}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            passwordAction === 'remove'
                              ? 'bg-red-600 text-white'
                              : 'bg-gray-800/50 text-gray-400 hover:text-white'
                          }`}
                        >
                          Remove password
                        </button>
                      )}
                    </div>

                    {passwordAction === 'set' && (
                      <div className="relative mt-3 animate-in fade-in slide-in-from-top-2">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter new password (min. 4 characters)"
                          autoComplete="new-password"
                          name="edit-link-password"
                          id="edit-link-password-input"
                          data-1p-ignore="true"
                          data-lpignore="true"
                          data-form-type="other"
                          className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors"
                          maxLength={100}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                        {password.length > 0 && password.length < 4 && (
                          <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                            <AlertCircle size={12} />
                            Minimum 4 characters required
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* TAB 3: TARGETING */}
            <div className={activeTab === 'targeting' ? 'space-y-8' : 'hidden'}>
              <DeviceTargetingSection
                deviceRedirects={deviceRedirects}
                setDeviceRedirects={setDeviceRedirects}
                isLocked={deviceTargetingField.isLocked}
                upgradePath={deviceTargetingField.upgradePath}
              />

              {/* Priority Conflict Warning */}
              {deviceRedirects.enabled && timeRedirects.enabled && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <Info className="text-amber-400 shrink-0 mt-0.5" size={16} />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-amber-200">Time rules take priority</p>
                    <p className="text-xs text-amber-200/70 leading-relaxed">
                      When active, time rules override device rules. Visitors matching a time window
                      go to that destination, regardless of device.
                    </p>
                  </div>
                </div>
              )}

              <TimeRoutingSection
                timeRedirects={timeRedirects}
                setTimeRedirects={setTimeRedirects}
                isLocked={timeRedirectsField.isLocked}
                upgradePath={timeRedirectsField.upgradePath}
              />
            </div>
          </div>

          {/* Bottom Scroll Indicator */}
          {showBottomArrow && (
            <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center pointer-events-none">
              <div className="bg-gradient-to-t from-gray-900 via-gray-900/90 to-transparent px-4 py-2 flex items-center gap-1 text-gray-400">
                <ChevronDown size={16} className="animate-bounce" />
                <span className="text-xs">Scroll for more</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 shrink-0 flex items-center justify-end gap-3 bg-gray-900/95 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-300 hover:text-white font-medium hover:bg-gray-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              isSaving ||
              !url ||
              !isValidUrl(url) ||
              (customAlias.length > 0 && customAlias.length < 3) ||
              (customAlias &&
                customAlias !== link.customAlias &&
                aliasStatus.available === false) ||
              (expiresAction === 'custom' && !customExpiresAt) ||
              (passwordAction === 'set' && password.length > 0 && password.length < 4)
            }
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-xl shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
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
      </div>
    </div>,
    document.body
  );
};

export default EditLinkModal;
