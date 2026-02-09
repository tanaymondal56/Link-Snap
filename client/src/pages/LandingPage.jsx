import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
// Lazy load QRCodeSVG (only needed after link creation)
const QRCodeSVG = lazy(() =>
  import('qrcode.react').then((module) => ({ default: module.QRCodeSVG }))
);
import {
  Copy,
  Check,
  ArrowRight,
  Link as LinkIcon,
  Zap,
  Shield,
  BarChart,
  ExternalLink,
  Sparkles,
  Loader2,
  AlertCircle,
  Clock,
  Lock,
  Eye,
  EyeOff,
  Crown,
  LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { hasUnseenChangelog, markChangelogAsSeen } from '../config/version';
import { useAppVersion } from '../hooks/useAppVersion';
import showToast from '../utils/toastUtils';
import { getShortUrl, getDisplayShortUrl } from '../utils/urlHelper';
const LinkSuccessModal = lazy(() => import('../components/LinkSuccessModal'));
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { isFreeTier } from '../utils/subscriptionUtils';
import { ProBadge } from '../components/subscription/PremiumField';
import { usePremiumField } from '../hooks/usePremiumField';

// Expiration presets for landing page
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
  // Basic check: has protocol and at least a domain with TLD
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

// Get base domain and display version (truncated for long URLs)
const getBaseDomain = () => {
  const fullUrl = getShortUrl('');
  return fullUrl.replace(/\/$/, '');
};

// Get a display-friendly version of the domain (truncate if too long)
const getDisplayDomain = (fullDomain) => {
  // Remove protocol for display
  const domain = fullDomain.replace(/^https?:\/\//, '');

  // If domain is short enough, show it all
  if (domain.length <= 20) {
    return domain;
  }

  // For long domains (like Cloudflare tunnels), truncate with ellipsis
  // Show first 8 chars + ... + last 8 chars
  return `${domain.slice(0, 8)}...${domain.slice(-8)}`;
};

const LandingPage = () => {
  const { user, openAuthModal } = useAuth();
  const appVersion = useAppVersion();
  const [url, setUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [shortUrl, setShortUrl] = useState(null);
  const [createdLink, setCreatedLink] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showNewBadge, setShowNewBadge] = useState(hasUnseenChangelog());

  // Expiration state (for logged-in users)
  const [expiresIn, setExpiresIn] = useState('never');
  const [customExpiresAt, setCustomExpiresAt] = useState('');

  // Password state (for logged-in users)
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Alias availability state
  const [aliasStatus, setAliasStatus] = useState({
    checking: false,
    available: null,
    reason: null,
  });

  const debouncedAlias = useDebounce(customAlias, 400);
  const baseDomain = getBaseDomain();
  const displayDomain = getDisplayDomain(baseDomain);

  // Premium field access states - called at component level
  const aliasField = usePremiumField('custom_alias');
  const expirationField = usePremiumField('link_expiration');
  const passwordField = usePremiumField('password_protection');

  // Hover states for premium field tooltips
  const [showAliasUpgrade, setShowAliasUpgrade] = useState(false);
  const [showExpirationUpgrade, setShowExpirationUpgrade] = useState(false);
  const [showPasswordUpgrade, setShowPasswordUpgrade] = useState(false);

  // Guest warning state
  const [showGuestWarning, setShowGuestWarning] = useState(false);

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
    if (debouncedAlias && user) {
      checkAlias(debouncedAlias);
    } else {
      setAliasStatus({ checking: false, available: null, reason: null });
    }
  }, [debouncedAlias, checkAlias, user]);

  // Handle alias input
  const handleAliasChange = (e) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
    setCustomAlias(value.slice(0, 20));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    handleLinkCreation();
  };

  const handleLinkCreation = async (isConfirmedGuest = false) => {
    if (!url) return;

    // Validate URL format
    if (!isValidUrl(url)) {
      showToast.warning('Please enter a valid URL (e.g., google.com)', 'Invalid URL');
      return;
    }

    // If custom alias is provided, check availability
    if (user && customAlias && customAlias.length >= 3 && aliasStatus.available === false) {
      showToast.error(aliasStatus.reason || 'This alias is not available');
      return;
    }

    // Validate password if enabled
    if (user && enablePassword && password.length < 4) {
      showToast.error('Password must be at least 4 characters');
      return;
    }

    // Check for guest user and show warning
    if (!user && !isConfirmedGuest) {
      setShowGuestWarning(true);
      return;
    }

    setIsLoading(true);
    try {
      const payload = { originalUrl: normalizeUrl(url) };

      // Add custom alias for logged-in users
      if (user && customAlias && customAlias.length >= 3) {
        payload.customAlias = customAlias;
      }

      // Add expiration for logged-in users
      if (user && expiresIn === 'custom' && customExpiresAt) {
        payload.expiresAt = new Date(customExpiresAt).toISOString();
      } else if (user && expiresIn && expiresIn !== 'never' && expiresIn !== 'custom') {
        payload.expiresIn = expiresIn;
      }

      // Add password for logged-in users
      if (user && enablePassword && password.length >= 4) {
        payload.password = password;
      }

      const { data } = await api.post('/url/shorten', payload);
      setShortUrl(getShortUrl(data.shortId));
      setCreatedLink(data);

      // Show success modal for all users (guests need to see expiry warning)
      setShowSuccessModal(true);

      showToast.success('Your short link is ready!', 'Link Created');
    } catch (error) {
      // Check if it's a network/offline error
      if (!navigator.onLine) {
        showToast.error(
          "You're offline. Please check your internet connection and try again.",
          'No Connection'
        );
      } else if (error.code === 'ERR_NETWORK' || !error.response) {
        showToast.error(
          "Couldn't reach the server. Please try again in a moment.",
          'Server Unavailable'
        );
      } else {
        const errData = error.response?.data;
        const msg = errData?.message || 'Failed to shorten link';

        if (errData?.type === 'anon_limit') {
          showToast.limit(msg, 'Free Limit Reached', [
            { label: 'Sign Up', onClick: () => openAuthModal('register') },
          ]);
        } else if (errData?.type === 'hard_limit') {
          showToast.upgrade(msg, 'Monthly Cap Hit');
        } else if (errData?.type === 'active_limit') {
          showToast.limit(msg, 'Maximum Links Reached');
        } else {
          showToast.error(msg);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    setUrl('');
    setCustomAlias('');
    setExpiresIn('never');
    setCustomExpiresAt('');
    setEnablePassword(false);
    setPassword('');
    setShowPassword(false);
    setShortUrl(null);
    setCreatedLink(null);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    showToast.success('Link copied to clipboard!', 'Copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const getAliasStatusIcon = () => {
    if (aliasStatus.checking) {
      return <Loader2 className="animate-spin text-gray-400" size={16} />;
    }
    if (aliasStatus.available === true) {
      return <Check className="text-green-400" size={16} />;
    }
    if (aliasStatus.available === false) {
      return <AlertCircle className="text-red-400" size={16} />;
    }
    return null;
  };

  return (
    <div className="flex flex-col relative overflow-hidden bg-gray-950 text-white font-sans selection:bg-purple-500/30 h-full">
      {/* SEO Meta Tags */}
      <Helmet>
        <title>Link Snap | Free URL Shortener with Analytics</title>
        <meta
          name="description"
          content="Create short, memorable links with powerful analytics. Track clicks, locations, and devices. Free forever with optional Pro features."
        />
        <meta property="og:title" content="Link Snap | Free URL Shortener" />
        <meta
          property="og:description"
          content="Shorten URLs, track clicks, and share smarter. Free forever."
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Link Snap | Free URL Shortener" />
        <meta
          name="twitter:description"
          content="Create short links with powerful analytics. Free forever."
        />
      </Helmet>

      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse delay-1000" />

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column: Text Content */}
          <div className="text-left space-y-8">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-300">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                Smart Analytics Included
              </div>
              {/* Version badge - visible on mobile, matches desktop styling */}
              <Link
                to="/changelog"
                onClick={() => {
                  markChangelogAsSeen();
                  setShowNewBadge(false);
                }}
                className="sm:hidden inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 transition-all text-xs font-medium relative"
              >
                {showNewBadge && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                )}
                <Sparkles className="w-3 h-3" />
                <span>v{appVersion}</span>
              </Link>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
              Make every <br />
              <span className="text-gradient bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
                connection count.
              </span>
            </h1>

            <p className="text-lg text-gray-400 max-w-xl leading-relaxed">
              A powerful URL shortener built for modern marketing. Track clicks, analyze audience
              data, and manage your links with a beautiful, intuitive dashboard.
            </p>

            <div className="flex flex-wrap gap-4 text-sm font-medium text-gray-300">
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-400" /> Real-Time Analytics
              </div>
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-400" /> Custom Branded Links
              </div>
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-400" /> Smart Targeting
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Card */}
          <div className="w-full">
            <div className="glass-dark p-8 rounded-3xl border border-white/10 shadow-2xl shadow-purple-500/10 relative overflow-hidden">
              {/* Decorative glow inside card */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Zap className="text-yellow-400" size={20} />
                Try it out
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                {/* Mobile Only: Go to Dashboard Button (Logged In) */}
                {user && (
                  <div className="md:hidden w-full mb-4">
                    <Link
                      to="/dashboard"
                      className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 mb-2"
                    >
                      <LayoutDashboard size={18} className="text-blue-400" />
                      Go to Dashboard
                    </Link>
                  </div>
                )}

                <div className="space-y-2">
                  <label
                    htmlFor="destination-url"
                    className="text-sm font-medium text-gray-300 ml-1"
                  >
                    Destination URL
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <LinkIcon
                        className={`h-5 w-5 transition-colors ${isValidUrl(url) ? 'text-green-400' : 'text-gray-500 group-focus-within:text-blue-400'}`}
                      />
                    </div>
                    <input
                      id="destination-url"
                      type="text"
                      required
                      className={`block w-full pl-11 pr-4 py-4 bg-gray-900/50 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all ${isValidUrl(url) ? 'border-green-500/50' : 'border-gray-700'}`}
                      placeholder="google.com or https://example.com/page"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                    {url && !isValidUrl(url) && (
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <span className="text-xs text-yellow-500">Invalid URL</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom Alias Input - Disabled with hover tooltip for non-Pro users */}
                <div
                  className="space-y-2 relative"
                  onMouseEnter={() => aliasField.isLocked && setShowAliasUpgrade(true)}
                  onMouseLeave={() => setShowAliasUpgrade(false)}
                >
                  <label
                    htmlFor="custom-alias"
                    className="text-sm font-medium text-gray-300 ml-1 flex items-center gap-2"
                  >
                    Custom Alias
                    <span className="text-xs text-gray-400 font-normal">(optional)</span>
                    {aliasField.isLocked ? (
                      <ProBadge />
                    ) : (
                      <Sparkles size={14} className="text-purple-400" />
                    )}
                  </label>
                  <div className="relative">
                    <span
                      className={`absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none truncate max-w-[45%] ${aliasField.isLocked ? 'opacity-50' : ''}`}
                      title={baseDomain}
                    >
                      {displayDomain}/
                    </span>
                    <input
                      id="custom-alias"
                      type="text"
                      disabled={aliasField.isLocked}
                      aria-label="Custom URL alias"
                      className={`block w-full pr-10 py-4 bg-gray-900/50 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all ${
                        aliasField.isLocked
                          ? 'border-gray-700/50 cursor-not-allowed opacity-50'
                          : customAlias.length === 0
                            ? 'border-gray-700'
                            : aliasStatus.available === true
                              ? 'border-green-500/50'
                              : aliasStatus.available === false
                                ? 'border-red-500/50'
                                : 'border-gray-700'
                      }`}
                      style={{ paddingLeft: `${displayDomain.length * 7.5 + 28}px` }}
                      placeholder="my-brand"
                      value={aliasField.isLocked ? '' : customAlias}
                      onChange={aliasField.isLocked ? undefined : handleAliasChange}
                      maxLength={20}
                    />
                    {/* Hover tooltip for locked state */}
                    {showAliasUpgrade && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm rounded-xl z-10">
                        <Link
                          to={aliasField.upgradePath}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-amber-500/30 transition-all"
                        >
                          <Crown size={16} />
                          {aliasField.upgradeText}
                        </Link>
                      </div>
                    )}
                    {/* Alias availability icon - only when not locked */}
                    {!aliasField.isLocked && (
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        {getAliasStatusIcon()}
                      </div>
                    )}
                  </div>
                  {!aliasField.isLocked && customAlias.length > 0 && customAlias.length < 3 && (
                    <p className="text-xs text-gray-500 ml-1">Minimum 3 characters</p>
                  )}
                  {!aliasField.isLocked &&
                    aliasStatus.reason &&
                    aliasStatus.available === false && (
                      <p className="text-xs text-red-400 ml-1">{aliasStatus.reason}</p>
                    )}
                  {!aliasField.isLocked && aliasStatus.available === true && (
                    <p className="text-xs text-green-400 ml-1">✓ This alias is available!</p>
                  )}
                </div>

                {/* Expiration Dropdown - Disabled with hover tooltip for non-Pro users */}
                <div
                  className="space-y-2 relative"
                  onMouseEnter={() => expirationField.isLocked && setShowExpirationUpgrade(true)}
                  onMouseLeave={() => setShowExpirationUpgrade(false)}
                >
                  <label
                    htmlFor="link-expiration"
                    className="text-sm font-medium text-gray-300 ml-1 flex items-center gap-2"
                  >
                    <Clock size={14} className="text-amber-400" />
                    Link Expiration
                    <span className="text-xs text-gray-400 font-normal">(optional)</span>
                    {expirationField.isLocked ? (
                      <ProBadge />
                    ) : (
                      <Sparkles size={14} className="text-amber-400" />
                    )}
                  </label>
                  <div className="relative">
                    <select
                      id="link-expiration"
                      value={expirationField.isLocked ? 'never' : expiresIn}
                      onChange={
                        expirationField.isLocked ? undefined : (e) => setExpiresIn(e.target.value)
                      }
                      disabled={expirationField.isLocked}
                      aria-label="Link expiration time"
                      className={`block w-full py-4 px-4 bg-gray-900/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all appearance-none ${expirationField.isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 1rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.5em 1.5em',
                      }}
                    >
                      {EXPIRATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {/* Hover tooltip for locked state */}
                    {showExpirationUpgrade && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm rounded-xl z-10">
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
                      min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                        .toISOString()
                        .slice(0, 16)}
                      className="block w-full py-3 px-4 mt-2 bg-gray-900/50 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                    />
                  )}
                </div>

                {/* Password Protection - Disabled with hover tooltip for non-Pro users */}
                <div
                  className="space-y-2 relative"
                  onMouseEnter={() => passwordField.isLocked && setShowPasswordUpgrade(true)}
                  onMouseLeave={() => setShowPasswordUpgrade(false)}
                >
                  <label className="text-sm font-medium text-gray-400 ml-1 flex items-center gap-2">
                    <Lock size={14} className="text-purple-400" />
                    Password Protection
                    <span className="text-xs text-gray-500 font-normal">(optional)</span>
                    {passwordField.isLocked ? (
                      <ProBadge />
                    ) : (
                      <Sparkles size={14} className="text-purple-400" />
                    )}
                  </label>
                  <div className="relative">
                    <div
                      className={`flex items-center gap-3 ${passwordField.isLocked ? 'opacity-50' : ''}`}
                    >
                      <button
                        type="button"
                        disabled={passwordField.isLocked}
                        aria-label={
                          enablePassword
                            ? 'Disable password protection'
                            : 'Enable password protection'
                        }
                        onClick={
                          passwordField.isLocked
                            ? undefined
                            : () => {
                                setEnablePassword(!enablePassword);
                                if (enablePassword) setPassword('');
                              }
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          passwordField.isLocked
                            ? 'bg-gray-700/50 cursor-not-allowed'
                            : enablePassword
                              ? 'bg-purple-600 cursor-pointer'
                              : 'bg-gray-700 cursor-pointer'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enablePassword && !passwordField.isLocked ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                      </button>
                      <span className="text-sm text-gray-400">
                        {passwordField.isLocked
                          ? 'Locked'
                          : enablePassword
                            ? 'Enabled'
                            : 'Disabled'}
                      </span>
                    </div>
                    {/* Hover tooltip for locked state */}
                    {showPasswordUpgrade && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm rounded-xl z-10">
                        <Link
                          to={passwordField.upgradePath}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-amber-500/30 transition-all"
                        >
                          <Crown size={16} />
                          {passwordField.upgradeText}
                        </Link>
                      </div>
                    )}
                  </div>
                  {!passwordField.isLocked && enablePassword && (
                    <div className="relative mt-2 group">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password (min. 4 characters)"
                        className="block w-full py-4 pl-4 pr-12 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                        maxLength={100}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                      {password.length > 0 && password.length < 4 && (
                        <p className="text-xs text-red-400 ml-1 mt-1">
                          Password must be at least 4 characters
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    (user && customAlias.length > 0 && customAlias.length < 3) ||
                    (user && customAlias && aliasStatus.available === false) ||
                    (user && enablePassword && password.length > 0 && password.length < 4) ||
                    (user && expiresIn === 'custom' && !customExpiresAt)
                  }
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isLoading ? 'Shortening...' : 'Shorten URL'}
                  {!isLoading && <ArrowRight size={20} />}
                </button>

                {/* Feature Upsell Text */}
                {user && (
                  <p className="text-center text-xs text-gray-400 mt-3 flex items-center justify-center gap-1.5 opacity-80">
                    <Sparkles size={12} className="text-purple-400" />
                    Many more features available in{' '}
                    <Link
                      to="/dashboard"
                      className="text-purple-400 hover:text-purple-300 hover:underline"
                    >
                      Dashboard
                    </Link>
                  </p>
                )}
              </form>

              {/* Result Area - Only show for non-logged-in users (logged-in users get modal) */}
              {shortUrl && !user && (
                <div className="mt-6 pt-6 border-t border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-gray-900/80 rounded-xl p-4 border border-green-500/20 flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="bg-green-500/20 p-2 rounded-lg text-green-400 shrink-0">
                          <Check size={18} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-gray-500">Shortened Link</span>
                          <a
                            href={shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 font-medium hover:underline text-sm sm:text-base"
                            title={shortUrl}
                          >
                            {/* Display truncated URL on mobile, fuller on desktop */}
                            <span className="sm:hidden">
                              {getDisplayShortUrl(
                                createdLink?.customAlias || createdLink?.shortId,
                                { maxDomainLength: 12 }
                              )}
                            </span>
                            <span className="hidden sm:inline">
                              {getDisplayShortUrl(
                                createdLink?.customAlias || createdLink?.shortId,
                                { maxDomainLength: 25 }
                              )}
                            </span>
                          </a>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={copyToClipboard}
                          className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
                          title="Copy to clipboard"
                        >
                          {copied ? (
                            <Check size={18} className="text-green-400" />
                          ) : (
                            <Copy size={18} />
                          )}
                        </button>
                        <a
                          href={shortUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-400 hover:text-blue-300 transition-colors"
                          title="Open link"
                        >
                          <ExternalLink size={18} />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center justify-center bg-white p-4 rounded-lg">
                      <Suspense fallback={<Loader2 className="animate-spin text-gray-500" />}>
                        <QRCodeSVG value={shortUrl} size={120} />
                      </Suspense>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Guest Warning Modal */}
      <ConfirmDialog
        isOpen={showGuestWarning}
        title="Create Temporary Link?"
        message={
          <div className="space-y-3 text-left">
            <p>
              You are about to create a link as a guest.{' '}
              <span className="text-amber-400 font-bold">
                Guest links expire in 7 days and cannot be edited.
              </span>
            </p>
            <p className="text-sm text-gray-400">
              To create permanent links, customize with your brand, and track analytics, please
              create an account.
            </p>
            <p className="text-sm text-center pt-2 border-t border-gray-700/50 mt-3">
              Already have an account?{' '}
              <button
                onClick={() => {
                  setShowGuestWarning(false);
                  openAuthModal('login');
                }}
                className="text-blue-400 hover:text-blue-300 font-medium hover:underline"
              >
                Login here
              </button>
            </p>
          </div>
        }
        confirmText="Continue as Guest"
        cancelText="Sign Up"
        variant="warning"
        onConfirm={() => {
          setShowGuestWarning(false);
          handleLinkCreation(true);
        }}
        onCancel={() => {
          setShowGuestWarning(false);
          openAuthModal('register');
        }}
        onClose={() => setShowGuestWarning(false)}
      />

      {/* Success Modal for Logged-in Users */}
      {showSuccessModal && (
        <Suspense fallback={null}>
          <LinkSuccessModal
            isOpen={showSuccessModal}
            onClose={handleSuccessModalClose}
            linkData={createdLink}
          />
        </Suspense>
      )}

      {/* Features & Footer Section */}
      <div className="border-t border-white/5 bg-black/20 backdrop-blur-sm mt-auto">
        {/* Features Grid */}
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex gap-4 items-start">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
              <Zap size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">Lightning Fast</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Redirects happen in milliseconds thanks to our global edge network.
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
              <BarChart size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">Deep Analytics</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Know your audience with detailed click tracking and location data.
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="p-3 rounded-xl bg-green-500/10 text-green-400">
              <Shield size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">Enterprise Secure</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Your data is protected with bank-grade encryption and security.
              </p>
            </div>
          </div>
        </div>

        {/* Pricing CTA - Only show for free tier or not logged in */}
        {(!user || isFreeTier(user)) && (
          <div className="max-w-7xl mx-auto px-6 pb-12">
            <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl border border-white/10 p-8 text-center">
              <h3 className="text-2xl font-bold text-white mb-2">Ready to level up?</h3>
              <p className="text-gray-400 mb-6 max-w-xl mx-auto">
                Get custom aliases, link expiration, password protection, and more with Pro.
              </p>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30"
              >
                View Pricing
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingPage;
