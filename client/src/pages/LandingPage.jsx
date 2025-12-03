import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
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
} from 'lucide-react';
import api from '../api/axios';
import showToast from '../components/ui/Toast';
import { getShortUrl } from '../utils/urlHelper';
import { useAuth } from '../context/AuthContext';
import LinkSuccessModal from '../components/LinkSuccessModal';

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

// Get base domain
const getBaseDomain = () => {
  const fullUrl = getShortUrl('');
  return fullUrl.replace(/\/$/, '');
};

const LandingPage = () => {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [shortUrl, setShortUrl] = useState(null);
  const [createdLink, setCreatedLink] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Alias availability state
  const [aliasStatus, setAliasStatus] = useState({
    checking: false,
    available: null,
    reason: null,
  });

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

    setIsLoading(true);
    try {
      const payload = { originalUrl: normalizeUrl(url) };

      // Add custom alias for logged-in users
      if (user && customAlias && customAlias.length >= 3) {
        payload.customAlias = customAlias;
      }

      const { data } = await api.post('/url/shorten', payload);
      setShortUrl(getShortUrl(data.shortId));
      setCreatedLink(data);

      // For logged-in users with any result, show success modal
      if (user) {
        setShowSuccessModal(true);
      }

      showToast.success('Your short link is ready!', 'Link Created');
    } catch (error) {
      showToast.error(error.response?.data?.message || 'Failed to shorten link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    setUrl('');
    setCustomAlias('');
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
              <Link
                to="/changelog"
                className="inline-flex items-center px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-xs font-semibold text-purple-300 hover:from-purple-500/30 hover:to-pink-500/30 transition-all"
              >
                v0.5.1-beta
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

            <div className="flex flex-wrap gap-4 text-sm font-medium text-gray-500">
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-400" /> Free Forever
              </div>
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-400" /> No Credit Card
              </div>
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-400" /> Unlimited Links
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Card */}
          <div className="w-full">
            <div className="glass-dark p-8 rounded-3xl border border-white/10 shadow-2xl shadow-purple-500/10 relative overflow-hidden">
              {/* Decorative glow inside card */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Zap className="text-yellow-400" size={20} />
                Try it out
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-400 ml-1">Destination URL</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <LinkIcon
                        className={`h-5 w-5 transition-colors ${isValidUrl(url) ? 'text-green-400' : 'text-gray-500 group-focus-within:text-blue-400'}`}
                      />
                    </div>
                    <input
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

                {/* Custom Alias Input - Only for logged in users */}
                {user && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-400 ml-1 flex items-center gap-2">
                      Custom Alias
                      <span className="text-xs text-gray-500 font-normal">(optional)</span>
                      <Sparkles size={14} className="text-purple-400" />
                    </label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
                        {baseDomain}/
                      </span>
                      <input
                        type="text"
                        className={`block w-full pr-10 py-4 bg-gray-900/50 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all ${
                          customAlias.length === 0
                            ? 'border-gray-700'
                            : aliasStatus.available === true
                              ? 'border-green-500/50'
                              : aliasStatus.available === false
                                ? 'border-red-500/50'
                                : 'border-gray-700'
                        }`}
                        style={{ paddingLeft: `${baseDomain.length * 7.5 + 20}px` }}
                        placeholder="my-brand"
                        value={customAlias}
                        onChange={handleAliasChange}
                        maxLength={20}
                      />
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        {getAliasStatusIcon()}
                      </div>
                    </div>
                    {customAlias.length > 0 && customAlias.length < 3 && (
                      <p className="text-xs text-gray-500 ml-1">Minimum 3 characters</p>
                    )}
                    {aliasStatus.reason && aliasStatus.available === false && (
                      <p className="text-xs text-red-400 ml-1">{aliasStatus.reason}</p>
                    )}
                    {aliasStatus.available === true && (
                      <p className="text-xs text-green-400 ml-1">✓ This alias is available!</p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    (user && customAlias.length > 0 && customAlias.length < 3) ||
                    (user && customAlias && aliasStatus.available === false)
                  }
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isLoading ? 'Shortening...' : 'Shorten URL'}
                  {!isLoading && <ArrowRight size={20} />}
                </button>
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
                            className="text-blue-400 font-medium truncate hover:underline"
                          >
                            {shortUrl}
                          </a>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
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
                      <QRCodeSVG value={shortUrl} size={120} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Success Modal for Logged-in Users */}
      <LinkSuccessModal
        isOpen={showSuccessModal}
        onClose={handleSuccessModalClose}
        linkData={createdLink}
      />

      {/* Footer / Features Compact */}
      <div className="border-t border-white/5 bg-black/20 backdrop-blur-sm py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
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
      </div>
    </div>
  );
};

export default LandingPage;
