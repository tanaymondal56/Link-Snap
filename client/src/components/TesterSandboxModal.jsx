import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import showToast from '../utils/toastUtils';
import {
  FlaskConical,
  X,
  Clock,
  Zap,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  CreditCard,
  KeyRound,
  AlertOctagon,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';

const TEST_CODES = [
  { code: 'TEST-PRO-1MIN', label: 'Pro 1 Min', desc: 'Rapid 60s expiration' },
  { code: 'TEST-PRO-5MIN', label: 'Pro 5 Mins', desc: '5 min test cycle' },
  { code: 'TEST-PRO-1DAY', label: 'Pro 1 Day', desc: '24 hours Pro access' },
  { code: 'TEST-PRO-30DAY', label: 'Pro 30 Days', desc: 'Full monthly Pro cycle' },
  { code: 'TEST-BUS-1DAY', label: 'Business 1 Day', desc: '24 hours Business tier' },
];

export default function TesterSandboxModal() {
  const { user, isTester, refreshUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // 'redeem' | 'buy' | 'expire' | 'reset' | 'status'

  // Tester subscription status
  const [status, setStatus] = useState(null);
  const [testCodeInput, setTestCodeInput] = useState('');

  // Mock payment gateway state
  const [buyTier, setBuyTier] = useState('pro');
  const [buyDuration, setBuyDuration] = useState('5m');

  // Real-time countdown
  const [timeRemainingMs, setTimeRemainingMs] = useState(0);
  const lastSyncRef = useRef({ remainingMs: 0, timestamp: 0 });

  // Multi-tap tracker for covert mobile trigger
  const tapsRef = useRef([]);

  // Check if environment is beta or local
  // Check if environment is beta or local
  const isBetaOrLocal = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const h = window.location.hostname.toLowerCase();
    return (
      import.meta.env.DEV ||
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '::1' ||
      h === '[::1]' ||
      Boolean(h.match(/^192\.168\.\d{1,3}\.\d{1,3}$/)) ||
      Boolean(h.match(/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) ||
      Boolean(h.match(/^172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}$/)) ||
      h === 'beta.lksnp.qzz.io' ||
      h === 'api-beta.lksnp.qzz.io' ||
      (h.endsWith('.lksnp.qzz.io') && (h.startsWith('beta.') || h.startsWith('api-beta.'))) ||
      (h.endsWith('.pages.dev') && h.includes('beta'))
    );
  }, []);

  const isAuthorized = Boolean(
    isTester ||
    ['admin', 'master_admin', 'master'].includes(user?.role) ||
    user?.type === 'master'
  );

  // Fetch status from dedicated tester endpoint
  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/tester/status');
      setStatus(data);
      let initialRemaining = 0;
      if (typeof data.timeRemainingMs === 'number') {
        initialRemaining = Math.max(0, data.timeRemainingMs);
      } else if (data.currentPeriodEnd) {
        initialRemaining = Math.max(0, new Date(data.currentPeriodEnd).getTime() - Date.now());
      }
      setTimeRemainingMs(initialRemaining);
      lastSyncRef.current = {
        remainingMs: initialRemaining,
        timestamp: Date.now(),
      };
    } catch (err) {
      // Fail closed silently if 404 or unauthorized
      if (err.response?.status !== 404 && err.response?.status !== 403) {
        showToast.error('Failed to retrieve tester status');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Open modal handler with status refresh
  const openModal = useCallback(() => {
    setIsOpen(true);
    fetchStatus();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 50, 40]);
    }
  }, [fetchStatus]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // GHOST MODE COVERT TRIGGERS: Desktop & Mobile & Dev Console
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // 100% INERT on production: Do NOT attach any listeners outside beta/staging/local
    if (!isBetaOrLocal) {
      return;
    }

    // 1. Desktop Covert Trigger:
    // Support physical key code or key character for universal cross-platform layout support
    // Shortcuts supported:
    // • Ctrl + Alt + T / Cmd + Option + T (Classic, 3 keys, no browser conflicts)
    // • Ctrl + Shift + X / Cmd + Shift + X (Developer standard, zero conflicts)
    // • Ctrl + Alt + Shift + T / Cmd + Option + Shift + T (Original 4-key combo)
    const handleKeyDown = (e) => {
      // Ignore when user is typing inside text inputs or contentEditable
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) ||
        e.target?.isContentEditable
      ) {
        return;
      }

      const isTKey = e.code === 'KeyT' || e.key?.toLowerCase() === 't';
      const isXKey = e.code === 'KeyX' || e.key?.toLowerCase() === 'x';
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      const isCombo1 = ctrlOrMeta && e.altKey && !e.shiftKey && isTKey;
      const isCombo2 = ctrlOrMeta && e.shiftKey && !e.altKey && isXKey;
      const isCombo3 = ctrlOrMeta && e.altKey && e.shiftKey && isTKey;

      if (isCombo1 || isCombo2 || isCombo3) {
        e.preventDefault();
        e.stopPropagation();

        if (!isAuthorized) {
          if (!user) {
            showToast.warning(
              'Please log in with an authorized Beta Tester or Admin account to access the Tester Sandbox.',
              'Authentication Required'
            );
          } else {
            showToast.error(
              `Account (${user.email || user.username}) is not authorized as a beta tester. Please add it in Admin Console > Settings > Authorized Beta Testers.`,
              'Tester Authorization Required'
            );
          }
          return;
        }

        if (isOpen) {
          closeModal();
        } else {
          openModal();
          showToast.info('Tester Sandbox Unlocked', 'Covert Access');
        }
      } else if (e.key === 'Escape' && isOpen) {
        closeModal();
      }
    };

    // 2. Mobile Covert Trigger: 3 rapid taps within 1500ms on version, tier, or snapId badge
    const handlePointerDown = (e) => {
      const target = e.target;
      if (!target) return;

      const isCovertTarget =
        target.closest('[data-covert-trigger="tester"]') ||
        target.closest('a[href="/changelog"]') ||
        target.closest('[data-snapid]') ||
        target.closest('.tier-badge') ||
        (typeof target.innerText === 'string' &&
          (/^v\d+\.\d+/i.test(target.innerText.trim()) ||
            /^SP-\d+/i.test(target.innerText.trim())));

      if (!isCovertTarget) return;

      const now = Date.now();
      const recentTaps = tapsRef.current.filter((t) => now - t < 1500);
      recentTaps.push(now);
      tapsRef.current = recentTaps;

      if (recentTaps.length > 1) {
        e.preventDefault();
      }

      if (recentTaps.length >= 3) {
        tapsRef.current = [];
        e.preventDefault();
        e.stopPropagation();

        if (!isAuthorized) {
          if (!user) {
            showToast.warning(
              'Please log in with an authorized Beta Tester or Admin account to access the Tester Sandbox.',
              'Authentication Required'
            );
          } else {
            showToast.error(
              `Account (${user.email || user.username}) is not authorized as a beta tester.`,
              'Tester Authorization Required'
            );
          }
          return;
        }

        openModal();
        showToast.info('Beta Tester Sandbox Unlocked', 'Covert Access');
      }
    };

    // 3. DevTools Console & Window Event Hook for direct testing
    window.__openTesterSandbox = () => {
      if (!isAuthorized) {
        if (!user) {
          showToast.warning(
            'Please log in with an authorized Beta Tester or Admin account.',
            'Authentication Required'
          );
        } else {
          showToast.error(
            `Account (${user.email || user.username}) is not authorized as a beta tester.`,
            'Tester Authorization Required'
          );
        }
        return false;
      }
      openModal();
      return true;
    };

    const handleCustomTrigger = () => {
      window.__openTesterSandbox?.();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('linksnap:open-tester-sandbox', handleCustomTrigger);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('linksnap:open-tester-sandbox', handleCustomTrigger);
      delete window.__openTesterSandbox;
    };
  }, [isBetaOrLocal, isAuthorized, user, isOpen, openModal, closeModal]);

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL-TIME EXPIRATION COUNTDOWN TIMER (Ticks every second)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isOpen || !status?.currentPeriodEnd) return;

    const timer = setInterval(() => {
      const { remainingMs, timestamp } = lastSyncRef.current;
      const elapsed = Date.now() - timestamp;
      const remaining = Math.max(0, remainingMs - elapsed);
      setTimeRemainingMs(remaining);

      // Auto-expire detection: reached 0 from an active tier
      if (remaining === 0 && status.effectiveTier !== 'free') {
        clearInterval(timer);
        refreshUser(true);
        fetchStatus();
        showToast.warning('Test subscription expired!', 'Downgraded');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, status?.currentPeriodEnd, status?.effectiveTier, refreshUser, fetchStatus]);

  // Format countdown milliseconds to display string
  const formattedCountdown = useMemo(() => {
    if (!status?.currentPeriodEnd) return null;
    if (timeRemainingMs <= 0) return '00:00:00 (Expired)';

    const totalSec = Math.floor(timeRemainingMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const pad = (n) => String(n).padStart(2, '0');

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return `${days}d ${pad(remHours)}h ${pad(mins)}m ${pad(secs)}s`;
    }

    return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  }, [status?.currentPeriodEnd, timeRemainingMs]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS: Redeem Code, Simulate Buy, Force Expire, Reset to Free
  // ═══════════════════════════════════════════════════════════════════════════

  const handleRedeem = async (codeToRedeem) => {
    const code = (codeToRedeem || testCodeInput).trim().toUpperCase();
    if (!code) {
      showToast.warning('Please enter or select a test code');
      return;
    }

    setActionLoading('redeem');
    try {
      const { data } = await api.post('/tester/redeem', { code });
      showToast.success(data.message || `Activated test code: ${code}`);
      setTestCodeInput('');
      await refreshUser(true);
      await fetchStatus();
    } catch (err) {
      showToast.error(err.response?.data?.message || 'Failed to redeem test code');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSimulateBuy = async () => {
    setActionLoading('buy');
    try {
      const { data } = await api.post('/tester/simulate-buy', {
        tier: buyTier,
        duration: buyDuration,
      });
      showToast.success(data.message || `Simulated ${buyTier.toUpperCase()} purchase!`);
      await refreshUser(true);
      await fetchStatus();
    } catch (err) {
      showToast.error(err.response?.data?.message || 'Failed to simulate purchase');
    } finally {
      setActionLoading(null);
    }
  };

  const handleExpireNow = async () => {
    setActionLoading('expire');
    try {
      const { data } = await api.post('/tester/expire-now');
      showToast.warning(data.message || 'Subscription force-expired');
      await refreshUser(true);
      await fetchStatus();
    } catch (err) {
      showToast.error(err.response?.data?.message || 'Failed to expire subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReset = async () => {
    setActionLoading('reset');
    try {
      const { data } = await api.post('/tester/reset');
      showToast.success(data.message || 'Reset to default Free plan');
      await refreshUser(true);
      await fetchStatus();
    } catch (err) {
      showToast.error(err.response?.data?.message || 'Failed to reset subscription');
    } finally {
      setActionLoading(null);
    }
  };

  // 100% INERT Ghost Mode: if not authorized or not in beta/local, render nothing
  if (!isBetaOrLocal || !isAuthorized || !isOpen) {
    return null;
  }

  const currentTier = status?.effectiveTier || user?.subscription?.tier || 'free';
  const isCurrentlyExpired = status?.currentPeriodEnd && timeRemainingMs <= 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tester-sandbox-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity animate-in fade-in"
        onClick={closeModal}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl bg-gray-950 border border-purple-500/30 rounded-3xl shadow-2xl shadow-purple-950/50 overflow-hidden z-10 my-auto animate-in zoom-in-95 duration-200">
        {/* Glow accent banner */}
        <div className="h-1.5 bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500" />

        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner">
              <FlaskConical size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="tester-sandbox-title" className="text-lg sm:text-xl font-bold text-white">
                  Beta Tester Sandbox
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full">
                  Ghost Mode Active
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Covert subscription sandbox &amp; rapid lifecycle simulator
              </p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close tester sandbox"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Subscription HUD Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs uppercase tracking-wider text-gray-400 font-medium">
                  Current Effective Tier
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-2xl font-black uppercase tracking-wide ${
                      currentTier === 'business'
                        ? 'text-pink-400'
                        : currentTier === 'pro'
                        ? 'text-purple-400'
                        : 'text-gray-300'
                    }`}
                  >
                    {currentTier}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                      isCurrentlyExpired
                        ? 'bg-red-500/20 text-red-300 border-red-500/30'
                        : status?.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-gray-700/50 text-gray-300 border-gray-600'
                    }`}
                  >
                    {isCurrentlyExpired ? 'Expired' : status?.status || 'Active'}
                  </span>
                  {status?.isTest && (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Test Mode
                    </span>
                  )}
                </div>
              </div>

              {/* Countdown Timer */}
              {status?.currentPeriodEnd && (
                <div className="text-right">
                  <span className="text-xs uppercase tracking-wider text-gray-400 font-medium flex items-center gap-1 justify-end">
                    <Clock size={12} className="text-purple-400" />
                    Expiration Countdown
                  </span>
                  <div
                    className={`text-lg sm:text-xl font-mono font-bold mt-1 ${
                      isCurrentlyExpired
                        ? 'text-red-400'
                        : timeRemainingMs < 60000
                        ? 'text-amber-400 animate-pulse'
                        : 'text-emerald-400'
                    }`}
                  >
                    {formattedCountdown}
                  </div>
                </div>
              )}
            </div>

            {/* Sub-HUD Meta details */}
            <div className="pt-3 border-t border-white/5 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-gray-400">
              <div>
                <span className="text-gray-500 block">Variant ID:</span>
                <span className="font-mono text-gray-200 truncate block">
                  {status?.variantId || 'None'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Tester Identity:</span>
                <span className="text-gray-200 truncate block">{user?.email}</span>
              </div>
              <div className="col-span-2 sm:col-span-1 flex items-center justify-end">
                <button
                  onClick={fetchStatus}
                  disabled={loading}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs transition-colors"
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Section 1: Tester Code Entry Box */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-white flex items-center gap-2">
                <KeyRound size={16} className="text-purple-400" />
                Redeem Instant Tester Code
              </label>
              <span className="text-xs text-gray-400">Multi-use test vouchers</span>
            </div>

            {/* Quick-fill chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TEST_CODES.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => handleRedeem(item.code)}
                  disabled={actionLoading === 'redeem'}
                  className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-purple-500/10 border border-white/10 hover:border-purple-500/30 text-left transition-all group disabled:opacity-50"
                >
                  <div className="text-xs font-bold text-white group-hover:text-purple-300 flex items-center justify-between">
                    <span>{item.label}</span>
                    <Sparkles size={12} className="text-purple-400 opacity-60 group-hover:opacity-100" />
                  </div>
                  <div className="text-[11px] text-gray-400 truncate mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>

            {/* Custom Input field */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={testCodeInput}
                onChange={(e) => setTestCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
                placeholder="ENTER TEST CODE (e.g. TEST-PRO-1MIN)"
                className="flex-1 bg-gray-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 uppercase"
              />
              <button
                onClick={() => handleRedeem()}
                disabled={actionLoading === 'redeem' || !testCodeInput.trim()}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-purple-600/20 disabled:opacity-50 flex items-center gap-2 shrink-0"
              >
                {actionLoading === 'redeem' ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Zap size={16} />
                )}
                Redeem
              </button>
            </div>
          </div>

          {/* Section 2: Simulated Buy (Mock Payment Gateway) */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">
                  Simulated Buy (Mock Payment Gateway)
                </h3>
              </div>
              <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                0 charges • Instant mock webhook
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Tier Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Subscription Tier
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBuyTier('pro')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      buyTier === 'pro'
                        ? 'bg-purple-600/20 border-purple-500 text-purple-200 shadow-md shadow-purple-500/10'
                        : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    Pro Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuyTier('business')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      buyTier === 'business'
                        ? 'bg-pink-600/20 border-pink-500 text-pink-200 shadow-md shadow-pink-500/10'
                        : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    Business Plan
                  </button>
                </div>
              </div>

              {/* Duration Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Test Duration
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: '1m', label: '1m' },
                    { id: '5m', label: '5m' },
                    { id: '1d', label: '1d' },
                    { id: '30d', label: '30d' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setBuyDuration(d.id)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                        buyDuration === d.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                          : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSimulateBuy}
              disabled={actionLoading === 'buy'}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {actionLoading === 'buy' ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <ShoppingBag size={16} />
              )}
              Simulate Instant Purchase ({buyTier.toUpperCase()} • {buyDuration})
            </button>
          </div>

          {/* Section 3: Rapid Control Actions */}
          <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleExpireNow}
                disabled={actionLoading === 'expire' || currentTier === 'free'}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold transition-colors disabled:opacity-40"
              >
                {actionLoading === 'expire' ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <AlertOctagon size={14} />
                )}
                Force Expire Now
              </button>

              <button
                onClick={handleReset}
                disabled={actionLoading === 'reset'}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-semibold transition-colors disabled:opacity-40"
              >
                {actionLoading === 'reset' ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <RotateCcw size={14} />
                )}
                Reset to Free
              </button>
            </div>

            <div className="text-[11px] text-gray-500 flex items-center gap-1.5 self-end sm:self-auto">
              <ShieldCheck size={14} className="text-emerald-400" />
              Protected by 3-Layer Gate
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
