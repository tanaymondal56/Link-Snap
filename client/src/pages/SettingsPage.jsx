import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import {
  User,
  Mail,
  Phone,
  Building2,
  Globe,
  Calendar,
  Save,
  Loader2,
  Shield,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  Copy,
  Check,
  AlertCircle,
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  Clock,
  LogOut,
  Trash2,
  RefreshCw,
  X,
  AlertTriangle,
  Timer,
  Edit2,
  ShieldCheck,
  CreditCard,
  Zap,
  BarChart3,
  Crown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { formatDate } from '../utils/dateUtils';
import api from '../api/axios';
import showToast from '../utils/toastUtils';
import { handleApiError } from '../utils/errorHandler';
import IdBadge from '../components/ui/IdBadge';
const SubscriptionCard = lazy(() => import('../components/subscription/SubscriptionCard'));
import { getEffectiveTier } from '../utils/subscriptionUtils';

const SettingsPage = () => {
  const { refreshUser } = useAuth();
  const location = useLocation();
  const getInitialTab = () => {
    const searchParams = new URLSearchParams(location.search);
    if (location.state?.activeTab) return location.state.activeTab;
    if (searchParams.get('upgrade') === 'success') return 'subscription';
    if (searchParams.get('tab') === 'subscription') return 'subscription';
    return 'profile';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedSnapId, setCopiedSnapId] = useState(false);

  // Tabs scroll logic
  const tabsRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const checkScroll = () => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5); // 5px buffer
    }
  };

  useEffect(() => {
    // Only check scroll if not loading and element exists
    if (!isLoading) {
      // Small delay to ensure DOM is ready
      setTimeout(checkScroll, 100);
    }
  }, [isLoading]);

  useEffect(() => {
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const scrollTabs = (direction) => {
    if (tabsRef.current) {
      const scrollAmount = 150;
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const handleCopySnapId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedSnapId(true);
    showToast('Snap ID copied to clipboard', 'success');
    setTimeout(() => setCopiedSnapId(false), 2000);
  };

  // Session state
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [terminatingSession, setTerminatingSession] = useState(null);
  const [terminatingAll, setTerminatingAll] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    sessionId: null,
    sessionName: '',
    action: null,
  });
  const [editingSession, setEditingSession] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('idle'); // idle | checking | available | taken | invalid | reserved
  const [usernameChangedAt, setUsernameChangedAt] = useState(null);
  const [savingName, setSavingName] = useState(false);
  const [togglingTrust, setTogglingTrust] = useState(null);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    username: '',
    firstName: '',
    lastName: '',
    phone: '',
    company: '',
    website: '',
    bio: '',
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [changingPassword, setChangingPassword] = useState(false);

  // Define fetchProfile BEFORE the useEffect that depends on it (const is not hoisted)
  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setProfile(data);
      setUsernameChangedAt(data.usernameChangedAt);
      setProfileForm({
        username: data.username || '',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        phone: data.phone || '',
        company: data.company || '',
        website: data.website || '',
        bio: data.bio || '',
      });
      // Force a global context refresh to synchronize the Dashboard tierTheme CSS variables
      if (refreshUser) refreshUser();
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      handleApiError(error, 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchSessions();
    }
  }, [activeTab]);

  // Close confirmation modal on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && confirmModal.isOpen) {
        setConfirmModal({ isOpen: false, sessionId: null, sessionName: '', action: null });
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [confirmModal.isOpen]);

  // Calculate if username change is allowed (30-day cooldown)
  const canChangeUsername =
    !usernameChangedAt ||
    Date.now() - new Date(usernameChangedAt).getTime() >= 30 * 24 * 60 * 60 * 1000;
  const nextUsernameChangeDate = usernameChangedAt
    ? new Date(new Date(usernameChangedAt).getTime() + 30 * 24 * 60 * 60 * 1000)
    : null;

  // Debounced username availability check
  useEffect(() => {
    if (!canChangeUsername || !profileForm.username || profileForm.username === profile?.username) {
      setUsernameStatus('idle');
      return;
    }
    if (profileForm.username.length < 3 || profileForm.username.length > 30) {
      setUsernameStatus('invalid');
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(profileForm.username)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    const timeoutId = setTimeout(async () => {
      try {
        const { data } = await api.get(`/auth/check-username/${profileForm.username}`);
        setUsernameStatus(
          data.available ? 'available' : data.reason === 'reserved' ? 'reserved' : 'taken'
        );
      } catch {
        setUsernameStatus('idle');
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [profileForm.username, profile?.username, canChangeUsername]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      if (profileForm.username && profileForm.username !== profile.username) {
        if (profileForm.username.length < 3 || profileForm.username.length > 30) {
          showToast.warning('Username must be 3-30 characters long', 'Invalid Username');
          setIsSaving(false);
          return;
        }
        if (!/^[a-z0-9_-]+$/.test(profileForm.username)) {
          showToast.warning(
            'Username can only contain lowercase letters, numbers, underscores, and dashes',
            'Invalid Username'
          );
          setIsSaving(false);
          return;
        }
        if (usernameStatus === 'taken' || usernameStatus === 'reserved') {
          showToast.warning('This username is not available', 'Username Taken');
          setIsSaving(false);
          return;
        }
      }
      const { data } = await api.put('/auth/me', profileForm);
      setProfile(data);
      showToast.success('Your profile has been updated!', 'Profile Saved');
    } catch (error) {
      console.error('Failed to save profile:', error);
      handleApiError(error, 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast.error('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      showToast.warning('Password must be at least 8 characters long', 'Weak Password');
      setIsLoading(false);
    }

    setChangingPassword(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      showToast.success('Your password has been changed!', 'Password Updated');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('Failed to change password:', error);
      handleApiError(error, 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  // Session management functions
  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const { data } = await api.get('/sessions');
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      handleApiError(error, 'Failed to load sessions');
    } finally {
      setSessionsLoading(false);
    }
  };

  // Helper to get session display name
  const getSessionDisplayName = (session) => {
    const browser = session.deviceInfo?.browser || 'Unknown';
    const os = session.deviceInfo?.os || 'Unknown';
    return `${browser} on ${os}`;
  };

  // Show confirmation before terminating a session
  const confirmTerminateSession = (session) => {
    setConfirmModal({
      isOpen: true,
      sessionId: session.id,
      sessionName: getSessionDisplayName(session),
      action: 'single',
    });
  };

  // Show confirmation before terminating all other sessions
  const confirmTerminateAll = () => {
    const otherCount = sessions.filter((s) => !s.isCurrent).length;
    setConfirmModal({
      isOpen: true,
      sessionId: null,
      sessionName: `${otherCount} other session${otherCount !== 1 ? 's' : ''}`,
      action: 'all',
    });
  };

  // Execute termination after confirmation
  const executeTerminate = async () => {
    const { sessionId, action } = confirmModal;
    setConfirmModal({ isOpen: false, sessionId: null, sessionName: '', action: null });

    if (action === 'single' && sessionId) {
      setTerminatingSession(sessionId);
      try {
        await api.delete(`/sessions/${sessionId}`);
        setSessions(sessions.filter((s) => s.id !== sessionId));
        showToast.success('Session terminated successfully');
      } catch (error) {
        handleApiError(error, 'Failed to terminate session');
      } finally {
        setTerminatingSession(null);
      }
    } else if (action === 'all') {
      setTerminatingAll(true);
      try {
        const { data } = await api.delete('/sessions/others');
        await fetchSessions();
        showToast.success(`${data.terminatedCount} session(s) terminated`);
      } catch (error) {
        handleApiError(error, 'Failed to terminate sessions');
      } finally {
        setTerminatingAll(false);
      }
    }
  };

  // Update session custom name
  const updateSessionName = async (sessionId) => {
    setSavingName(true);
    try {
      const { data } = await api.patch(`/sessions/${sessionId}/name`, { name: editingName });
      setSessions(
        sessions.map((s) => (s.id === sessionId ? { ...s, customName: data.customName } : s))
      );
      setEditingSession(null);
      setEditingName('');
      showToast.success('Session name updated');
    } catch (error) {
      handleApiError(error, 'Failed to update session name');
    } finally {
      setSavingName(false);
    }
  };

  // Toggle session trust status
  const toggleTrustSession = async (session) => {
    setTogglingTrust(session.id);
    try {
      const newTrusted = !session.isTrusted;
      const { data } = await api.patch(`/sessions/${session.id}/trust`, { trusted: newTrusted });
      setSessions(
        sessions.map((s) => (s.id === session.id ? { ...s, isTrusted: data.isTrusted } : s))
      );
      showToast.success(data.isTrusted ? 'Device marked as trusted' : 'Device trust removed');
    } catch (error) {
      handleApiError(error, 'Failed to update device trust');
    } finally {
      setTogglingTrust(null);
    }
  };

  // Start editing a session name
  const startEditingSession = (session) => {
    setEditingSession(session.id);
    setEditingName(session.customName || '');
  };

  // Cancel editing session name
  const cancelEditingSession = () => {
    setEditingSession(null);
    setEditingName('');
  };

  const getDeviceIcon = (device) => {
    switch (device) {
      case 'Mobile':
        return <Smartphone size={20} className="text-blue-400" />;
      case 'Tablet':
        return <Tablet size={20} className="text-purple-400" />;
      default:
        return <Monitor size={20} className="text-green-400" />;
    }
  };

  const formatRelativeTime = (date) => {
    if (!date) return 'Unknown';
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return formatDate(date);
  };

  const formatExpiryTime = (expiresAt) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry - now;
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMs <= 0) return { text: 'Expired', urgent: true };
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / 3600000);
      return { text: diffHours <= 1 ? 'Expires soon' : `Expires in ${diffHours}h`, urgent: true };
    }
    if (diffDays === 1) return { text: 'Expires tomorrow', urgent: true };
    if (diffDays < 3) return { text: `Expires in ${diffDays} days`, urgent: true };
    if (diffDays < 7) return { text: `Expires in ${diffDays} days`, warning: true };
    return { text: `Expires in ${diffDays} days`, normal: true };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your account settings and preferences</p>
      </div>
      {/* Tabs */}
      <div className="relative mx-auto w-full group">
        {/* Left Arrow (Mobile/Desktop if needed) */}
        <div
          className={`absolute left-0 top-0 bottom-1 z-10 flex items-center px-1 bg-gradient-to-r from-gray-900 via-gray-900/80 to-transparent transition-opacity duration-300 ${!showLeftArrow ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          <button
            onClick={() => scrollTabs('left')}
            className="p-1.5 rounded-full bg-gray-800 border border-gray-700 text-white shadow-xl hover:bg-gray-700 active:scale-95 transition-all"
            aria-label="Scroll left"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        <div
          ref={tabsRef}
          onScroll={checkScroll}
          className="flex gap-2 border-b border-gray-700/50 overflow-x-auto overflow-y-hidden touch-pan-x scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 items-center"
        >
          <button
            onClick={() => setActiveTab('profile')}
            className={`shrink-0 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'profile' ? '' : 'border-transparent opacity-60 hover:opacity-100'
            }`}
            style={
              activeTab === 'profile'
                ? { color: 'var(--heading-color)', borderBottomColor: 'var(--accent-from)' }
                : { color: 'var(--subtext-color)' }
            }
          >
            <span className="flex items-center gap-2">
              <User size={16} />
              Profile
            </span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`shrink-0 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'security' ? '' : 'border-transparent opacity-60 hover:opacity-100'
            }`}
            style={
              activeTab === 'security'
                ? { color: 'var(--heading-color)', borderBottomColor: 'var(--accent-from)' }
                : { color: 'var(--subtext-color)' }
            }
          >
            <span className="flex items-center gap-2">
              <Shield size={16} />
              Security
            </span>
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`shrink-0 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'sessions' ? '' : 'border-transparent opacity-60 hover:opacity-100'
            }`}
            style={
              activeTab === 'sessions'
                ? { color: 'var(--heading-color)', borderBottomColor: 'var(--accent-from)' }
                : { color: 'var(--subtext-color)' }
            }
          >
            <span className="flex items-center gap-2">
              <Monitor size={16} />
              Sessions
            </span>
          </button>
          <button
            onClick={() => setActiveTab('subscription')}
            className={`shrink-0 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'subscription' ? '' : 'border-transparent opacity-60 hover:opacity-100'
            }`}
            style={
              activeTab === 'subscription'
                ? { color: 'var(--heading-color)', borderBottomColor: 'var(--accent-from)' }
                : { color: 'var(--subtext-color)' }
            }
          >
            <span className="flex items-center gap-2">
              <CreditCard size={16} />
              Subscription
            </span>
          </button>
          {/* Spacer for right fade */}
          <div className="w-8 shrink-0 sm:hidden" />
        </div>

        {/* Right Arrow */}
        <div
          className={`absolute right-0 top-0 bottom-1 z-10 flex items-center justify-end px-1 bg-gradient-to-l from-gray-900 via-gray-900/80 to-transparent transition-opacity duration-300 ${!showRightArrow ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          <button
            onClick={() => scrollTabs('right')}
            className="p-1.5 rounded-full bg-gray-800 border border-gray-700 text-white shadow-xl hover:bg-gray-700 active:scale-95 transition-all"
            aria-label="Scroll right"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Profile Card */}
          <div
            className="rounded-2xl transition-colors duration-300 overflow-hidden"
            style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
          >
            <div className="p-6" style={{ borderBottom: '1px solid var(--divider-color)' }}>
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, var(--avatar-from), var(--avatar-to))',
                  }}
                >
                  {profileForm.firstName
                    ? profileForm.firstName[0].toUpperCase()
                    : profile?.email?.[0].toUpperCase() || 'U'}
                </div>
                <div>
                  <h2
                    className="text-lg font-semibold flex items-center gap-2"
                    style={{ color: 'var(--heading-color)' }}
                  >
                    {profileForm.firstName || profileForm.lastName
                      ? `${profileForm.firstName} ${profileForm.lastName}`.trim()
                      : profile?.email}
                    {/* Crown Badge for Paid Tiers */}
                    {(getEffectiveTier(profile) === 'pro' ||
                      getEffectiveTier(profile) === 'business') && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-yellow-500 text-xs font-bold rounded-full border border-yellow-500/30">
                        <Crown size={12} fill="currentColor" />
                        {getEffectiveTier(profile).toUpperCase()}
                      </span>
                    )}
                  </h2>
                  <p className="text-gray-400 text-sm">{profile?.email}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {profile?.eliteId && profile?.idTier && (
                      <IdBadge eliteId={profile.eliteId} idTier={profile.idTier} size="sm" />
                    )}

                    {profile?.snapId && (
                      <div className="flex items-center pl-0 h-5">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900/60 rounded border border-white/10 hover:border-blue-500/30 transition-colors group">
                          <span className="text-[10px] text-slate-500 font-bold tracking-wider">
                            ID
                          </span>
                          <code className="text-[11px] text-blue-400 font-mono tracking-wide">
                            {profile.snapId}
                          </code>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopySnapId(profile.snapId);
                            }}
                            className="ml-1 text-slate-600 hover:text-white transition-colors"
                            title="Copy Snap ID"
                          >
                            {copiedSnapId ? (
                              <Check size={10} className="text-green-500" />
                            ) : (
                              <Copy size={10} className="group-hover:text-blue-400" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    <span className="text-gray-500 text-xs flex items-center gap-1 ml-1">
                      <Calendar size={12} />
                      Joined {profile?.createdAt ? formatDate(profile.createdAt) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Form */}
            <div className="p-6 space-y-6">
              {/* Username Field */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username
                  {!canChangeUsername && (
                    <span className="ml-2 text-xs text-amber-500">
                      (Change available on {nextUsernameChangeDate?.toLocaleDateString()})
                    </span>
                  )}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={profileForm.username}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
                      })
                    }
                    disabled={!canChangeUsername}
                    className={`w-full pl-11 pr-12 py-3 rounded-xl bg-gray-800/50 border text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                      !canChangeUsername
                        ? 'opacity-50 cursor-not-allowed border-gray-700'
                        : usernameStatus === 'available'
                          ? 'border-green-500/50'
                          : usernameStatus === 'taken' ||
                              usernameStatus === 'reserved' ||
                              usernameStatus === 'invalid'
                            ? 'border-red-500/50'
                            : 'border-gray-700'
                    }`}
                    placeholder="username"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                    {!canChangeUsername && <Timer className="w-5 h-5 text-amber-500" />}
                    {canChangeUsername && usernameStatus === 'checking' && (
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                    )}
                    {canChangeUsername && usernameStatus === 'available' && (
                      <Check className="w-5 h-5 text-green-500" />
                    )}
                    {canChangeUsername &&
                      (usernameStatus === 'taken' ||
                        usernameStatus === 'reserved' ||
                        usernameStatus === 'invalid') && <X className="w-5 h-5 text-red-500" />}
                  </div>
                </div>
                <p
                  className={`text-xs mt-1 ${
                    usernameStatus === 'available'
                      ? 'text-green-500'
                      : usernameStatus === 'taken' || usernameStatus === 'reserved'
                        ? 'text-red-500'
                        : usernameStatus === 'invalid'
                          ? 'text-red-500'
                          : 'text-gray-500'
                  }`}
                >
                  {!canChangeUsername
                    ? `You can change your username once every 30 days`
                    : usernameStatus === 'available'
                      ? 'Available!'
                      : usernameStatus === 'taken'
                        ? 'Already taken'
                        : usernameStatus === 'reserved'
                          ? 'Not available'
                          : usernameStatus === 'invalid'
                            ? 'Invalid format'
                            : 'Unique identifier.'}
                </p>
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">First Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      value={profileForm.firstName}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, firstName: e.target.value })
                      }
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      placeholder="John"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Doe"
                  />
                </div>
              </div>

              {/* Email (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-gray-800/30 border border-gray-700/50 text-gray-400 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Company / Organization
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={profileForm.company}
                    onChange={(e) => setProfileForm({ ...profileForm, company: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Acme Inc."
                  />
                </div>
              </div>

              {/* Website */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Website</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="url"
                    value={profileForm.website}
                    onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Bio</label>
                <textarea
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                  placeholder="Tell us a bit about yourself..."
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {profileForm.bio.length}/500
                </p>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-8 py-3 text-white font-bold rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{
                    background: 'linear-gradient(to right, var(--accent-from), var(--accent-to))',
                    boxShadow: '0 8px 20px var(--cta-shadow)',
                  }}
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Subscription Tab */}
      {activeTab === 'subscription' && (
        <Suspense
          fallback={
            <div className="glass-dark p-6 rounded-2xl border border-white/5 h-96 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          }
        >
          <SubscriptionCard profile={profile} onRefresh={fetchProfile} />
        </Suspense>
      )}{' '}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Account Status */}
          <div
            className="rounded-2xl transition-colors duration-300 p-6"
            style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield size={20} className="text-blue-400" />
              Security Status
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <CheckCircle size={18} className="text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Email Verified</p>
                  <p className="text-xs text-gray-400">{profile?.email}</p>
                </div>
              </div>

              {/* Replaced 'Account Type' with 'Last Login' as requested (using proxy or real data) */}
              <div className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Clock size={18} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Last Login</p>
                  <p className="text-xs text-gray-400">
                    {profile?.lastLoginAt ? formatDate(profile.lastLoginAt) : 'Just now'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Change Password */}
          <div
            className="rounded-2xl transition-colors duration-300 p-6"
            style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Key size={20} className="text-yellow-400" />
              Change Password
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                    }
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Enter current password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswords({ ...showPasswords, current: !showPasswords.current })
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                    }
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Enter new password (min 6 characters)"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                    }
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Confirm new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {passwordForm.confirmPassword &&
                  passwordForm.newPassword !== passwordForm.confirmPassword && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle size={12} />
                      Passwords do not match
                    </p>
                  )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changingPassword ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Key size={18} />
                  )}
                  {changingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Danger Zone */}
          <div
            className="rounded-2xl transition-colors duration-300 p-6"
            style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <h3 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h3>
            <p className="text-sm text-gray-400 mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <button
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl transition-colors text-sm font-medium"
              onClick={() =>
                showToast.info('Contact support to delete your account', 'Delete Account')
              }
            >
              Delete Account
            </button>
          </div>
        </div>
      )}
      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          {/* Active Sessions */}
          <div
            className="rounded-2xl transition-colors duration-300 p-6"
            style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Monitor size={20} className="text-green-400" />
                  Active Sessions
                </h3>
                <p className="text-gray-400 text-sm mt-1">
                  Manage your active login sessions across devices
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchSessions}
                  disabled={sessionsLoading}
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Refresh sessions"
                >
                  <RefreshCw
                    size={16}
                    className={`text-gray-400 ${sessionsLoading ? 'animate-spin' : ''}`}
                  />
                </button>
                {sessions.length > 1 && (
                  <button
                    onClick={confirmTerminateAll}
                    disabled={terminatingAll}
                    className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm rounded-lg transition-colors"
                  >
                    {terminatingAll ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <LogOut size={14} />
                    )}
                    Logout Others
                  </button>
                )}
              </div>
            </div>

            {sessionsLoading && sessions.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-gray-400" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No active sessions found</p>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-4 rounded-xl border transition-all ${
                      session.isCurrent
                        ? 'bg-green-500/10 border-green-500/30'
                        : session.isTrusted
                          ? 'bg-blue-500/5 border-blue-500/30'
                          : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-gray-700/50 rounded-lg">
                          {getDeviceIcon(session.deviceInfo?.device)}
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* Custom name or default name with editing support */}
                          {editingSession === session.id ? (
                            <div className="flex items-center gap-2 mb-1">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') updateSessionName(session.id);
                                  if (e.key === 'Escape') cancelEditingSession();
                                }}
                                placeholder="Enter device name..."
                                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 w-40"
                                maxLength={50}
                                autoFocus
                              />
                              <button
                                onClick={() => updateSessionName(session.id)}
                                disabled={savingName}
                                className="p-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition-colors disabled:opacity-50"
                              >
                                {savingName ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Check size={14} />
                                )}
                              </button>
                              <button
                                onClick={cancelEditingSession}
                                className="p-1 bg-gray-600/50 hover:bg-gray-600 text-gray-400 rounded transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mb-1">
                              {session.customName && (
                                <span
                                  className="font-semibold text-white truncate max-w-[180px]"
                                  title={session.customName}
                                >
                                  {session.customName}
                                </span>
                              )}
                              <button
                                onClick={() => startEditingSession(session)}
                                className="p-1 hover:bg-gray-700 rounded transition-colors"
                                title="Rename device"
                              >
                                <Edit2 size={12} className="text-gray-500 hover:text-gray-300" />
                              </button>
                            </div>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-white">
                              {session.deviceInfo?.browser || 'Unknown'}{' '}
                              {session.deviceInfo?.browserVersion
                                ? `${session.deviceInfo.browserVersion}`
                                : ''}
                            </span>
                            <span className="text-gray-500">on</span>
                            <span className="text-gray-300">
                              {session.deviceInfo?.os || 'Unknown'}
                              {session.deviceInfo?.osVersion
                                ? ` ${session.deviceInfo.osVersion}`
                                : ''}
                            </span>
                            {session.isCurrent && (
                              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                                This Device
                              </span>
                            )}
                            {session.isTrusted && (
                              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/30 flex items-center gap-1">
                                <ShieldCheck size={10} />
                                Trusted
                              </span>
                            )}
                          </div>
                          {/* Device model for mobile devices */}
                          {session.deviceInfo?.deviceModel && (
                            <p className="text-sm text-gray-400 mt-0.5">
                              {session.deviceInfo.deviceVendor
                                ? `${session.deviceInfo.deviceVendor} `
                                : ''}
                              {session.deviceInfo.deviceModel}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <MapPin size={12} />
                              {session.ipAddress || 'Unknown IP'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              Active {formatRelativeTime(session.lastActiveAt)}
                            </span>
                            {session.deviceInfo?.cpuArch && (
                              <span className="text-gray-600">{session.deviceInfo.cpuArch}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-600 flex-wrap">
                            <span>Logged in {formatRelativeTime(session.createdAt)}</span>
                            {session.expiresAt &&
                              (() => {
                                const expiry = formatExpiryTime(session.expiresAt);
                                if (!expiry) return null;
                                return (
                                  <span
                                    className={`flex items-center gap-1 ${
                                      expiry.urgent
                                        ? 'text-red-400'
                                        : expiry.warning
                                          ? 'text-yellow-400'
                                          : 'text-gray-500'
                                    }`}
                                  >
                                    <Timer size={12} />
                                    {expiry.text}
                                  </span>
                                );
                              })()}
                          </div>
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Trust toggle button */}
                        <button
                          onClick={() => toggleTrustSession(session)}
                          disabled={togglingTrust === session.id}
                          className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                            session.isTrusted
                              ? 'bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400'
                              : 'bg-gray-700/50 hover:bg-gray-700 text-gray-400'
                          }`}
                          title={session.isTrusted ? 'Remove trust' : 'Mark as trusted'}
                        >
                          {togglingTrust === session.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <ShieldCheck size={16} />
                          )}
                        </button>
                        {/* Terminate button (not for current session) */}
                        {!session.isCurrent && (
                          <button
                            onClick={() => confirmTerminateSession(session)}
                            disabled={terminatingSession === session.id}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg transition-colors"
                            title="Terminate session"
                          >
                            {terminatingSession === session.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-dark rounded-2xl border border-gray-700/50 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <AlertTriangle size={24} className="text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {confirmModal.action === 'all' ? 'Logout Other Devices?' : 'End Session?'}
                </h3>
              </div>
              <button
                onClick={() =>
                  setConfirmModal({ isOpen: false, sessionId: null, sessionName: '', action: null })
                }
                className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <p className="text-gray-400 mb-6">
              {confirmModal.action === 'all'
                ? `This will terminate ${confirmModal.sessionName} and log them out immediately.`
                : `This will end the session on ${confirmModal.sessionName} and log it out immediately.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() =>
                  setConfirmModal({ isOpen: false, sessionId: null, sessionName: '', action: null })
                }
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeTerminate}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <LogOut size={16} />
                {confirmModal.action === 'all' ? 'Logout All' : 'End Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
