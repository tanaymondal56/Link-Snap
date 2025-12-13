import { useState, useEffect } from 'react';
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
  Check,
} from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import api from '../api/axios';
import showToast from '../components/ui/Toast';
import { handleApiError } from '../utils/errorHandler';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Session state
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [terminatingSession, setTerminatingSession] = useState(null);
  const [terminatingAll, setTerminatingAll] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, sessionId: null, sessionName: '', action: null });
  const [editingSession, setEditingSession] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [togglingTrust, setTogglingTrust] = useState(null);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
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

  useEffect(() => {
    fetchProfile();
  }, []);

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

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setProfile(data);
      setProfileForm({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        phone: data.phone || '',
        company: data.company || '',
        website: data.website || '',
        bio: data.bio || '',
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      handleApiError(error, 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
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

    if (passwordForm.newPassword.length < 6) {
      showToast.error('Password must be at least 6 characters');
      return;
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
      action: 'single'
    });
  };

  // Show confirmation before terminating all other sessions
  const confirmTerminateAll = () => {
    const otherCount = sessions.filter(s => !s.isCurrent).length;
    setConfirmModal({
      isOpen: true,
      sessionId: null,
      sessionName: `${otherCount} other session${otherCount !== 1 ? 's' : ''}`,
      action: 'all'
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
        setSessions(sessions.filter(s => s.id !== sessionId));
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
      setSessions(sessions.map(s => 
        s.id === sessionId ? { ...s, customName: data.customName } : s
      ));
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
      setSessions(sessions.map(s => 
        s.id === session.id ? { ...s, isTrusted: data.isTrusted } : s
      ));
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700/50">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'profile'
              ? 'text-white border-blue-500'
              : 'text-gray-400 border-transparent hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <User size={16} />
            Profile
          </span>
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'security'
              ? 'text-white border-blue-500'
              : 'text-gray-400 border-transparent hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <Shield size={16} />
            Security
          </span>
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'sessions'
              ? 'text-white border-blue-500'
              : 'text-gray-400 border-transparent hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <Monitor size={16} />
            Sessions
          </span>
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="glass-dark rounded-2xl border border-gray-700/50 overflow-hidden">
            <div className="p-6 border-b border-gray-700/50">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                  {profileForm.firstName
                    ? profileForm.firstName[0].toUpperCase()
                    : profile?.email?.[0].toUpperCase() || 'U'}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {profileForm.firstName || profileForm.lastName
                      ? `${profileForm.firstName} ${profileForm.lastName}`.trim()
                      : profile?.email}
                  </h2>
                  <p className="text-gray-400 text-sm">{profile?.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full border border-purple-500/30">
                      {profile?.role || 'user'}
                    </span>
                    <span className="text-gray-500 text-xs flex items-center gap-1">
                      <Calendar size={12} />
                      Joined{' '}
                      {profile?.createdAt ? formatDate(profile.createdAt) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Form */}
            <div className="p-6 space-y-6">
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
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Account Status */}
          <div className="glass-dark rounded-2xl border border-gray-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield size={20} className="text-blue-400" />
              Account Status
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
              <div className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <User size={18} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Account Type</p>
                  <p className="text-xs text-gray-400 capitalize">{profile?.role}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Change Password */}
          <div className="glass-dark rounded-2xl border border-gray-700/50 p-6">
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
          <div className="glass-dark rounded-2xl border border-red-500/30 p-6">
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
          <div className="glass-dark rounded-2xl border border-gray-700/50 p-6">
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
                  <RefreshCw size={16} className={`text-gray-400 ${sessionsLoading ? 'animate-spin' : ''}`} />
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
                                {savingName ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
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
                                <span className="font-semibold text-white truncate max-w-[180px]" title={session.customName}>
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
                              {session.deviceInfo?.browserVersion ? `${session.deviceInfo.browserVersion}` : ''}
                            </span>
                            <span className="text-gray-500">on</span>
                            <span className="text-gray-300">
                              {session.deviceInfo?.os || 'Unknown'}
                              {session.deviceInfo?.osVersion ? ` ${session.deviceInfo.osVersion}` : ''}
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
                              {session.deviceInfo.deviceVendor ? `${session.deviceInfo.deviceVendor} ` : ''}
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
                              <span className="text-gray-600">
                                {session.deviceInfo.cpuArch}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-600 flex-wrap">
                            <span>Logged in {formatRelativeTime(session.createdAt)}</span>
                            {session.expiresAt && (() => {
                              const expiry = formatExpiryTime(session.expiresAt);
                              if (!expiry) return null;
                              return (
                                <span className={`flex items-center gap-1 ${
                                  expiry.urgent ? 'text-red-400' : 
                                  expiry.warning ? 'text-yellow-400' : 
                                  'text-gray-500'
                                }`}>
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
                onClick={() => setConfirmModal({ isOpen: false, sessionId: null, sessionName: '', action: null })}
                className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <p className="text-gray-400 mb-6">
              {confirmModal.action === 'all'
                ? `This will terminate ${confirmModal.sessionName} and log them out immediately.`
                : `This will end the session on ${confirmModal.sessionName} and log it out immediately.`
              }
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmModal({ isOpen: false, sessionId: null, sessionName: '', action: null })}
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
