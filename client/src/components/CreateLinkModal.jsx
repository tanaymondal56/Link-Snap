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
} from 'lucide-react';
import api from '../api/axios';
import showToast from '../components/ui/Toast';
import { getShortUrl } from '../utils/urlHelper';

import { useScrollLock } from '../hooks/useScrollLock';
import { Link } from 'react-router-dom';
import { ProBadge } from './subscription/PremiumField';
import { usePremiumField } from '../hooks/usePremiumField';
import DeviceTargetingSection from './DeviceTargetingSection';

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

  // Hover states for premium field tooltips
  const [showAliasUpgrade, setShowAliasUpgrade] = useState(false);
  const [showExpirationUpgrade, setShowExpirationUpgrade] = useState(false);
  const [showPasswordUpgrade, setShowPasswordUpgrade] = useState(false);

  const debouncedAlias = useDebounce(customAlias, 400);
  const baseDomain = getBaseDomain();

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
      // Do NOT save password to localStorage - security best practice
      enablePassword, // Only save the toggle state, not the password itself
      deviceRedirects,
      savedAt: Date.now()
    };
    // Only save if there's actual content (use optional chaining for safety)
    if (url || customAlias || enablePassword || (deviceRedirects?.rules?.length > 0)) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }
  }, [url, customAlias, expiresIn, customExpiresAt, enablePassword, deviceRedirects]);

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
          setEnablePassword(draft.enablePassword || false);
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
  }, [isOpen, url, customAlias, expiresIn, customExpiresAt, enablePassword, deviceRedirects, saveDraft]);

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
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

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

      if (customAlias && customAlias.length >= 3) {
        payload.customAlias = customAlias;
      }

      // Add expiration
      if (expiresIn === 'custom' && customExpiresAt) {
        payload.expiresAt = new Date(customExpiresAt).toISOString();
      } else if (expiresIn && expiresIn !== 'never' && expiresIn !== 'custom') {
        payload.expiresIn = expiresIn;
      }

      // Add password
      if (enablePassword && password.length >= 4) {
        payload.password = password;
      }

      // Add device redirects
      if (deviceRedirects.rules.length > 0) {
        payload.deviceRedirects = {
          enabled: deviceRedirects.enabled,
          rules: deviceRedirects.rules.filter(r => r.url && r.url.trim() !== ''),
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

  // Handle alias input - only allow valid characters
  const handleAliasChange = (e) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
    setCustomAlias(value.slice(0, 20)); // Max 20 chars
  };

  if (!isOpen) return null;

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

    return createPortal(
    <div className="fixed inset-0 z-[1000] overflow-y-auto">
      <div 
        className="flex min-h-full items-start justify-center p-4 sm:items-center sm:pt-4"
        style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))' }}
      >
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

        {/* Modal - Allowed to grow */}
        <div className="relative w-full max-w-lg bg-gray-900/95 border border-gray-700/50 rounded-2xl shadow-2xl animate-modal-in flex flex-col my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <LinkIcon size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Create New Link</h2>
              <p className="text-sm text-gray-400">Shorten a URL with optional custom alias</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700/50 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form - Body */}
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
                      : 'border-gray-700 focus:border-green-500'
                }`}
                required
                autoFocus
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

          {/* Custom Alias Input - Pro Feature */}
          <div 
            className="relative"
            onMouseEnter={() => aliasField.isLocked && setShowAliasUpgrade(true)}
            onMouseLeave={() => setShowAliasUpgrade(false)}
          >
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <span className="flex items-center gap-2">
                  Custom Alias
                  <span className="text-xs text-gray-500 font-normal">(optional)</span>
                  {aliasField.isLocked ? <ProBadge /> : <Crown size={14} className="text-amber-400" />}
                </span>
              </label>
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none ${aliasField.isLocked ? 'opacity-50' : ''}`}>
                  {baseDomain}/
                </span>
                <input
                  type="text"
                  placeholder="my-brand"
                  value={aliasField.isLocked ? '' : customAlias}
                  onChange={aliasField.isLocked ? undefined : handleAliasChange}
                  disabled={aliasField.isLocked}
                  className={`w-full bg-gray-800/50 border rounded-xl pl-[${baseDomain.length * 7 + 24}px] pr-10 py-3 text-white placeholder-gray-500 focus:outline-none transition-colors ${aliasField.isLocked ? 'border-gray-700/50 cursor-not-allowed opacity-50' : getAliasInputBorderColor()}`}
                  style={{ paddingLeft: `${baseDomain.length * 7.5 + 20}px` }}
                  maxLength={20}
                />
                {!aliasField.isLocked && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {getAliasStatusIcon()}
                  </div>
                )}
                
                {/* Hover tooltip for locked state */}
                {showAliasUpgrade && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm rounded-xl z-20">
                    <Link
                      to={aliasField.upgradePath}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-amber-500/30 transition-all"
                    >
                      <Crown size={16} />
                      {aliasField.upgradeText}
                    </Link>
                  </div>
                )}
              </div>

              {/* Alias Status Message */}
              {!aliasField.isLocked && (
                <div className="mt-1.5 flex items-center justify-between">
                  <div>
                    {customAlias.length > 0 && customAlias.length < 3 && (
                      <p className="text-sm text-gray-500">Minimum 3 characters</p>
                    )}
                    {aliasStatus.reason && aliasStatus.available === false && (
                      <p className="text-sm text-red-400">{aliasStatus.reason}</p>
                    )}
                    {aliasStatus.available === true && (
                      <p className="text-sm text-green-400">✓ This alias is available!</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{customAlias.length}/20</span>
                </div>
              )}
            </div>
          </div>

          {/* Expiration Dropdown - Pro Feature */}
          <div 
            className="relative"
            onMouseEnter={() => expirationField.isLocked && setShowExpirationUpgrade(true)}
            onMouseLeave={() => setShowExpirationUpgrade(false)}
          >
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <span className="flex items-center gap-2">
                  <Clock size={14} className="text-amber-400" />
                  Link Expiration
                  {expirationField.isLocked ? <ProBadge /> : <Crown size={14} className="text-amber-400" />}
                </span>
              </label>
              <div className="relative">
                <select
                  value={expirationField.isLocked ? 'never' : expiresIn}
                  onChange={expirationField.isLocked ? undefined : (e) => setExpiresIn(e.target.value)}
                  disabled={expirationField.isLocked}
                  className={`w-full bg-gray-800/50 border rounded-xl px-4 py-3 text-white focus:outline-none transition-colors appearance-none ${expirationField.isLocked ? 'border-gray-700/50 cursor-not-allowed opacity-50' : 'border-gray-700 focus:border-amber-500 cursor-pointer'}`}
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
                >
                  {EXPIRATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                
                {/* Hover tooltip for locked state */}
                {showExpirationUpgrade && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm rounded-xl z-20">
                    <Link
                      to={expirationField.upgradePath}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-amber-500/30 transition-all"
                    >
                      <Crown size={16} />
                      {expirationField.upgradeText}
                    </Link>
                  </div>
                )}
              </div>
              
              {!expirationField.isLocked && expiresIn === 'custom' && (
                <input
                  type="datetime-local"
                  value={customExpiresAt}
                  onChange={(e) => setCustomExpiresAt(e.target.value)}
                  min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                  className="w-full mt-2 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none transition-colors"
                />
              )}
            </div>
          </div>

          {/* Password Protection Toggle - Pro Feature */}
          <div 
            className="relative"
            onMouseEnter={() => passwordField.isLocked && setShowPasswordUpgrade(true)}
            onMouseLeave={() => setShowPasswordUpgrade(false)}
          >
            <div>
              <label className={`flex items-center gap-3 group ${passwordField.isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={passwordField.isLocked ? false : enablePassword}
                    onChange={passwordField.isLocked ? undefined : (e) => setEnablePassword(e.target.checked)}
                    disabled={passwordField.isLocked}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-purple-500/50 peer-checked:bg-purple-600 transition-colors"></div>
                  <div className="absolute left-[2px] top-[2px] bg-white w-5 h-5 rounded-full transition-transform peer-checked:translate-x-5"></div>
                </div>
                <div className="flex items-center gap-2">
                  <Lock size={14} className="text-purple-400" />
                  <span className="text-sm font-medium text-gray-300">Password Protect</span>
                  {passwordField.isLocked ? <ProBadge /> : <Crown size={14} className="text-amber-400" />}
                </div>
              </label>
              
              {/* Hover tooltip for locked state */}
              {showPasswordUpgrade && (
                <div className="absolute inset-0 -m-2 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm rounded-xl z-20 pointer-events-none">
                  <div className="pointer-events-auto">
                    <Link
                      to={passwordField.upgradePath}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-amber-500/30 transition-all"
                    >
                      <Crown size={16} />
                      {passwordField.upgradeText}
                    </Link>
                  </div>
                </div>
              )}
              
              {!passwordField.isLocked && enablePassword && (
                <div className="mt-3 relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password (min. 4 characters)"
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
                    <p className="text-xs text-red-400 mt-1.5">Password must be at least 4 characters</p>
                  )}
                  {password.length >= 4 && (
                    <div className="mt-2">
                      <div className="flex gap-1">
                        <div className={`h-1 w-6 rounded-full ${password.length >= 4 ? 'bg-red-400' : 'bg-gray-600'}`} />
                        <div className={`h-1 w-6 rounded-full ${password.length >= 8 ? 'bg-amber-400' : 'bg-gray-600'}`} />
                        <div className={`h-1 w-6 rounded-full ${password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) ? 'bg-green-400' : 'bg-gray-600'}`} />
                      </div>
                      <p className={`text-xs mt-1 ${
                        password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) 
                          ? 'text-green-400'
                          : password.length >= 8 
                            ? 'text-amber-400' 
                            : 'text-red-400'
                      }`}>
                        {password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) 
                          ? '✓ Strong password' 
                          : password.length >= 8 
                            ? 'Medium strength' 
                            : 'Weak password'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Device Targeting - Pro/Business Feature */}
          <DeviceTargetingSection
            deviceRedirects={deviceRedirects}
            setDeviceRedirects={setDeviceRedirects}
            isLocked={deviceTargetingField.isLocked}
            upgradePath={deviceTargetingField.upgradePath}
          />

          {/* Preview */}
          {(customAlias.length >= 3 || url) && (
            <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Preview</p>
              <div className="flex items-center gap-2">
                <ExternalLink size={16} className="text-gray-400" />
                <span className="text-green-400 font-mono text-sm">
                  {baseDomain}/{customAlias.length >= 3 ? customAlias : 'xxxxxxxx'}
                </span>
                {expiresIn !== 'never' && (
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                    Expires: {EXPIRATION_OPTIONS.find(o => o.value === expiresIn)?.label}
                  </span>
                )}
                {enablePassword && password.length >= 4 && (
                  <Lock size={12} className="text-purple-400" />
                )}
              </div>
              {url && isValidUrl(url) && (
                <p className="text-xs text-gray-500 mt-2 truncate">→ {normalizeUrl(url)}</p>
              )}
            </div>
          )}
        </form>

        {/* Action Buttons - Fixed at bottom */}
        <div className="flex gap-3 p-5 pt-3 border-t border-gray-700/50 bg-gray-900/95">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isCreating ||
              !url ||
              !isValidUrl(url) ||
              (customAlias.length > 0 && customAlias.length < 3) ||
              (customAlias && aliasStatus.available === false) ||
              (expiresIn === 'custom' && !customExpiresAt) ||
              (enablePassword && password.length > 0 && password.length < 4)
            }
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-xl transition-all font-medium"
          >
            {isCreating ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Creating...
              </>
            ) : (
              <>
                <LinkIcon size={18} />
                Create Link
              </>
            )}
          </button>
        </div>
      </div>
      </div>
    </div>,
    document.body
  );
};

export default CreateLinkModal;
