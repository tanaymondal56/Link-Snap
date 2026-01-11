import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Link as LinkIcon,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  Clock,
  Lock,
  Eye,
  EyeOff,
  Crown,
  Globe,
  Info
} from 'lucide-react';
import api from '../api/axios';
import showToast from '../components/ui/Toast';
import { getShortUrl } from '../utils/urlHelper';

import { useScrollLock } from '../hooks/useScrollLock';
import { Link } from 'react-router-dom';
import { ProBadge } from './subscription/PremiumField';
import { usePremiumField } from '../hooks/usePremiumField';
import DeviceTargetingSection from './DeviceTargetingSection';
import TimeRoutingSection from './TimeRoutingSection';

// Expiration presets
const EXPIRATION_OPTIONS = [
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

// Check if a datetime-local value is in the past (for mobile browser fallback)
const isPastDate = (dateTimeString) => {
  if (!dateTimeString) return false;
  const selectedDate = new Date(dateTimeString);
  return selectedDate <= new Date();
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
  // Remove trailing slash
  return fullUrl.replace(/\/$/, '');
};

const CreateLinkModal = ({ isOpen, onClose, onSuccess }) => {
  const [url, setUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Expiration state
  const [expiresIn, setExpiresIn] = useState('never');
  const [customExpiresAt, setCustomExpiresAt] = useState('');
  
  // Password state
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Device targeting state
  const [deviceRedirects, setDeviceRedirects] = useState({
    enabled: false,
    rules: [],
  });

  // Schedule Activation (Free feature - link goes live at this time)
  const [enableSchedule, setEnableSchedule] = useState(false);
  const [activeStartTime, setActiveStartTime] = useState('');

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

  // Calculate badges/indicators
  const settingsActive = (expiresIn !== 'never' && expiresIn !== '') || enablePassword || enableSchedule;
  const targetingActive = (deviceRedirects.enabled && deviceRedirects.rules.length > 0) || (timeRedirects.enabled && timeRedirects.rules.length > 0);

  // Check alias availability
  const checkAlias = useCallback(async (alias) => {
    if (!alias || alias.length < 3) {
      setAliasStatus({ checking: false, available: null, reason: null });
      return;
    }

    setAliasStatus({ checking: true, available: null, reason: null });

    try {
      const { data } = await api.get(`/url/check-alias/${encodeURIComponent(alias)}`);
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
  }, []);

  // Trigger check when debounced alias changes
  useEffect(() => {
    if (debouncedAlias) {
      checkAlias(debouncedAlias);
    } else {
      setAliasStatus({ checking: false, available: null, reason: null });
    }
  }, [debouncedAlias, checkAlias]);

  // Storage key for draft persistence
  const DRAFT_KEY = 'linksnap_create_link_draft';

  // Save form draft to localStorage (excluding sensitive data like password)
  const saveDraft = useCallback(() => {
    const draft = {
      url,
      customAlias,
      expiresIn,
      customExpiresAt,
      // Do NOT save password or password-enabled state to localStorage - security best practice & prevents CodeQL alerts
      deviceRedirects,
      // TBR fields
      enableSchedule,
      activeStartTime,
      timeRedirects,
      savedAt: Date.now()
    };
    // Only save if there's actual content (use optional chaining for safety)
    if (url || customAlias || (deviceRedirects?.rules?.length > 0) || enableSchedule || (timeRedirects?.rules?.length > 0)) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }
  }, [url, customAlias, expiresIn, customExpiresAt, deviceRedirects, enableSchedule, activeStartTime, timeRedirects]);

  // Load draft from localStorage
  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        // Only restore if saved within last 24 hours
        if (draft.savedAt && Date.now() - draft.savedAt < 24 * 60 * 60 * 1000) {
          setUrl(draft.url || '');
          setCustomAlias(draft.customAlias || '');
          setExpiresIn(draft.expiresIn || 'never');
          setCustomExpiresAt(draft.customExpiresAt || '');
          // Password protection preference is not saved/restored
          // Password is never saved/loaded from localStorage for security
          // Validate deviceRedirects structure to prevent undefined access errors
          const savedDeviceRedirects = draft.deviceRedirects;
          if (savedDeviceRedirects && typeof savedDeviceRedirects === 'object' && Array.isArray(savedDeviceRedirects.rules)) {
            setDeviceRedirects({
              enabled: Boolean(savedDeviceRedirects.enabled),
              rules: savedDeviceRedirects.rules,
            });
          } else {
            setDeviceRedirects({ enabled: false, rules: [] });
          }
          
          // Restore TBR fields
          if (draft.enableSchedule !== undefined) {
            setEnableSchedule(Boolean(draft.enableSchedule));
          }
          if (draft.activeStartTime) {
            setActiveStartTime(draft.activeStartTime);
          }
          const savedTimeRedirects = draft.timeRedirects;
          if (savedTimeRedirects && typeof savedTimeRedirects === 'object' && Array.isArray(savedTimeRedirects.rules)) {
            setTimeRedirects({
              enabled: Boolean(savedTimeRedirects.enabled),
              timezone: savedTimeRedirects.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
              rules: savedTimeRedirects.rules,
            });
          }
          
          return true;
        }
      }
    } catch {
      // Ignore parse errors - clear corrupted draft
      localStorage.removeItem(DRAFT_KEY);
    }
    return false;
  }, []);

  // Clear draft
  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
  }, []);

  // Load draft when modal opens
  useEffect(() => {
    if (isOpen) {
      loadDraft();
    }
  }, [isOpen, loadDraft]);

  // Scroll Lock
  useScrollLock(isOpen);

  // Save draft periodically and on changes
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(saveDraft, 500); // Debounced save
      return () => clearTimeout(timer);
    }
  }, [isOpen, url, customAlias, expiresIn, customExpiresAt, deviceRedirects, saveDraft]);

  // Reset form when modal closes (but don't clear draft - that happens on success)
  useEffect(() => {
    if (!isOpen) {
      setUrl('');
      setCustomAlias('');
      setExpiresIn('never');
      setCustomExpiresAt('');
      setEnablePassword(false);
      setPassword('');
      setShowPassword(false);
      setDeviceRedirects({ enabled: false, rules: [] });
      setAliasStatus({ checking: false, available: null, reason: null });
      // Reset TBR states
      setEnableSchedule(false);
      setActiveStartTime('');
      setTimeRedirects({ enabled: false, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', rules: [] });
      setActiveTab('essentials');
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!url) return;

    if (!isValidUrl(url)) {
      return;
    }

    // If custom alias is provided, check if it's available
    if (customAlias && aliasStatus.available === false) {
      return;
    }

    // Validate password if enabled
    if (enablePassword && password.length < 4) {
      showToast.error('Password must be at least 4 characters');
      return;
    }

    setIsCreating(true);

    try {
      const payload = {
        originalUrl: normalizeUrl(url),
      };

      if (!aliasField.isLocked && customAlias && customAlias.length >= 3) {
        payload.customAlias = customAlias;
      }

      // Add expiration (Pro)
      if (!expirationField.isLocked) {
        if (expiresIn === 'custom' && customExpiresAt) {
          payload.expiresAt = new Date(customExpiresAt).toISOString();
        } else if (expiresIn && expiresIn !== 'never' && expiresIn !== 'custom') {
          payload.expiresIn = expiresIn;
        }
      }

      // Add password (Pro)
      if (!passwordField.isLocked && enablePassword && password.length >= 4) {
        payload.password = password;
      }

      // Add device redirects (Pro)
      if (!deviceTargetingField.isLocked && deviceRedirects.rules.length > 0) {
        payload.deviceRedirects = {
          enabled: deviceRedirects.enabled,
          rules: deviceRedirects.rules
            .filter(r => r.url && r.url.trim() !== '')
            .map(r => ({ ...r, url: normalizeUrl(r.url) })),
        };
      }

      // Add schedule activation (Free feature)
      if (enableSchedule && activeStartTime) {
        // Validate date is not in the past (mobile browsers may bypass min attribute)
        if (isPastDate(activeStartTime)) {
          showToast.error('Schedule time must be in the future');
          setActiveTab('settings');
          return;
        }
        payload.activeStartTime = new Date(activeStartTime).toISOString();
      }

      // Add time-based redirects (Pro feature)
      if (!timeRedirectsField.isLocked && timeRedirects.enabled && timeRedirects.rules.length > 0) {
        payload.timeRedirects = {
          enabled: true,
          timezone: timeRedirects.timezone,
          rules: timeRedirects.rules
            .filter(r => r.destination && r.startTime && r.endTime)
            .map(r => ({ ...r, destination: normalizeUrl(r.destination) })),
        };
      }

      const { data } = await api.post('/url/shorten', payload);
      clearDraft(); // Clear draft on successful creation
      onSuccess(data);
      onClose();
    } catch (error) {
      showToast.error(error.response?.data?.message || 'Failed to create link');
      console.error('Failed to create link:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Validation check for switching tabs on error
  const validateAndSubmit = async () => {
    // If password enabled but invalid, switch to settings
    if (enablePassword && password.length < 4) {
      setActiveTab('settings');
      // The handleSubmit will show the toast msg
    }
    handleSubmit();
  };

  // Handle alias input - only allow valid characters
  const handleAliasChange = (e) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
    setCustomAlias(value.slice(0, 20)); // Max 20 chars
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-gray-900/80">
      <div 
        className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-purple-400">
              Create New Link
            </h2>
            <p className="text-sm text-gray-400 mt-1">Shorten and customize your URL</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 gap-2 border-b border-gray-800 bg-gray-900/50 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('essentials')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'essentials' 
                ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' 
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
                ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' 
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            <div className="relative">
              <Lock size={16} />
              {settingsActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-violet-500 rounded-full ring-2 ring-gray-900" />
              )}
            </div>
            Settings
          </button>
          
          <button
            onClick={() => setActiveTab('targeting')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'targeting' 
                ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' 
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            <div className="relative">
              <Globe size={16} />
              {targetingActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-violet-500 rounded-full ring-2 ring-gray-900" />
              )}
            </div>
            Targeting
            <ProBadge className="ml-1 scale-75" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* TAB 1: ESSENTIALS */}
          <div className={activeTab === 'essentials' ? 'space-y-6' : 'hidden'}>
            
            {/* Destination URL */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-300">
                Destination URL <span className="text-red-400">*</span>
              </label>
              <div className="relative group">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/long-url"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 pl-11 text-white placeholder-gray-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 focus:outline-none transition-all group-hover:border-gray-600"
                  autoFocus
                />
                <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-hover:text-violet-400 transition-colors" size={18} />
              </div>
            </div>

            {/* Custom Alias */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <Sparkles size={16} className="text-violet-400" />
                Custom Link
                <Crown size={14} className="text-amber-400" />
              </label>
              
              {aliasField.isLocked ? (
                <div className="relative group overflow-hidden rounded-xl border border-gray-700 bg-gray-800/30 p-4 transition-all hover:border-orange-500/30">
                  <div className="flex items-center justify-between relative z-10">
                    <div>
                      <h4 className="font-medium text-gray-300 mb-1">Upgrade to customize</h4>
                      <p className="text-sm text-gray-500">Create branded links with custom back-halves.</p>
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
                    <span className="hidden sm:flex items-center px-4 py-3 bg-gray-800/50 border border-r-0 border-gray-700 rounded-l-xl text-gray-400 text-sm min-w-[140px]">
                      {baseDomain.replace(/^https?:\/\//, '')}/
                    </span>
                    <input
                      type="text"
                      value={customAlias}
                      onChange={handleAliasChange}
                      onBlur={() => checkAlias(customAlias)}
                      placeholder="custom-alias"
                      className="flex-1 bg-gray-800/30 border border-gray-700 sm:rounded-l-none rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 focus:outline-none transition-all"
                    />
                    {/* Alias Status Indicator */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {aliasStatus.checking ? (
                         <Loader2 size={16} className="animate-spin text-gray-400" />
                      ) : customAlias && customAlias.length >= 3 && (
                        aliasStatus.available ? (
                          <Check size={16} className="text-green-500" />
                        ) : (
                          <X size={16} className="text-red-500" />
                        )
                      )}
                    </div>
                  </div>
                  {customAlias && customAlias.length >= 3 && !aliasStatus.checking && !aliasStatus.available && (
                     <div className="absolute -bottom-6 left-0 flex items-center gap-1.5 text-xs text-red-400 animate-in fade-in slide-in-from-top-1">
                        <AlertCircle size={12} />
                        {aliasStatus.reason || 'Alias unavailable'}
                     </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* TAB 2: SETTINGS (Protection & Lifecycle) */}
          <div className={activeTab === 'settings' ? 'space-y-6' : 'hidden'}>
            
            {/* Schedule Activation */}
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
                   <input type="checkbox" checked={enableSchedule} onChange={(e) => setEnableSchedule(e.target.checked)} className="sr-only peer" />
                   <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                 </label>
               </div>
               
                {enableSchedule && (
                  <div className="mt-4 pt-4 border-t border-gray-700/50 animate-in slide-in-from-top-2">
                     <label className="block text-sm text-gray-400 mb-2">Start Time (Your Local Time)</label>
                     <div className="overflow-hidden rounded-lg">
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
                     </div>
                     {activeStartTime && (
                       <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
                         <p className="font-medium mb-1">Schedule Summary:</p>
                         <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-y-2 sm:gap-y-1 gap-x-4">
                           <div className="flex items-center justify-between gap-2 sm:contents">
                             <span className="text-blue-200/60">Local:</span>
                             <span className="text-right sm:text-left">{new Date(activeStartTime).toLocaleString()}</span>
                           </div>
                           <div className="flex items-center justify-between gap-2 sm:contents">
                             <span className="text-blue-200/60">UTC:</span>
                             <span className="font-mono text-right sm:text-left">{new Date(activeStartTime).toISOString().slice(0, 16).replace('T', ' ')} UTC</span>
                           </div>
                         </div>
                       </div>
                     )}
                  </div>
                )}
             </div>

            {/* Expiration */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <Clock size={16} className="text-orange-400" />
                Link Expiration
                <Crown size={14} className="text-amber-400" />
              </label>
              
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
                <div className="grid grid-cols-3 gap-2">
                  {EXPIRATION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setExpiresIn(option.value);
                        if (option.value !== 'custom') setCustomExpiresAt('');
                      }}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                        expiresIn === option.value
                          ? 'bg-orange-500/10 text-orange-400 border-orange-500/50'
                          : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-gray-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
              
              {!expirationField.isLocked && expiresIn === 'custom' && (
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
                  className="w-full mt-2 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                  min={new Date().toISOString().slice(0, 16)}
                />
              )}
            </div>

            {/* Password Protection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <Lock size={16} className="text-purple-400" />
                  Password Protection
                  <Crown size={14} className="text-amber-400" />
                </label>
                {!passwordField.isLocked && (
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={enablePassword} 
                      onChange={(e) => setEnablePassword(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                )}
              </div>

              {passwordField.isLocked ? (
                <div className="relative group overflow-hidden rounded-xl border border-gray-700 bg-gray-800/30 p-4 transition-all hover:border-purple-500/30">
                  <div className="flex items-center justify-between relative z-10">
                    <div>
                      <h4 className="font-medium text-gray-300 mb-1">Upgrade to set Password</h4>
                      <p className="text-sm text-gray-500">Secure your links from unauthorized access.</p>
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
                enablePassword && (
                    <div className="relative animate-in fade-in slide-in-from-top-2">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password (min. 4 characters)"
                        autoComplete="new-password"
                        name="new-link-password"
                        id="link-password-input"
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
                      
                      {/* Password Strength Indicators (Simplified for brevity as user verified) */}
                      {password.length > 0 && password.length < 4 && (
                        <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                          <AlertCircle size={12} />
                          Minimum 4 characters required
                        </p>
                      )}
                    </div>
                )
              )}
            </div>
          </div>

          {/* TAB 3: TARGETING (Device & Time) */}
          <div className={activeTab === 'targeting' ? 'space-y-8' : 'hidden'}>
            
            <DeviceTargetingSection 
              deviceRedirects={deviceRedirects}
              setDeviceRedirects={setDeviceRedirects}
              isLocked={deviceTargetingField.isLocked}
              upgradePath={deviceTargetingField.upgradePath}
            />

            <TimeRoutingSection
              timeRedirects={timeRedirects}
              setTimeRedirects={setTimeRedirects}
              isLocked={timeRedirectsField.isLocked}
              upgradePath={timeRedirectsField.upgradePath}
            />

          </div>

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
            onClick={validateAndSubmit}
            disabled={isCreating || !isValidUrl(url)}
            className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium rounded-xl shadow-lg hover:shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Create Link
                <Sparkles size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  , document.body);
};

export default CreateLinkModal;
