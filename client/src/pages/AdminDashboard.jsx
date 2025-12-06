import { useState, useEffect, Fragment } from 'react';
import api from '../api/axios';
import showToast from '../components/ui/Toast';
import { useConfirm } from '../context/ConfirmContext';
import { useDialog } from '../components/ui/DialogProvider';
import BanUserModal from '../components/BanUserModal';
import UnbanUserModal from '../components/UnbanUserModal';
import {
  Trash2,
  Users,
  Link as LinkIcon,
  BarChart2,
  Ban,
  CheckCircle,
  Search,
  ExternalLink,
  ShieldAlert,
  Settings,
  ToggleLeft,
  ToggleRight,
  Mail,
  Eye,
  EyeOff,
  Save,
  Send,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  X,
  Shield,
  Sparkles,
  User,
  Phone,
  Building2,
  Globe,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  UserX,
  History,
  FileText,
  MessageSquare,
  Loader2,
  RefreshCw,
  Timer,
} from 'lucide-react';

const AdminDashboard = () => {
  const confirm = useConfirm();
  const { prompt } = useDialog();
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'links', 'settings'
  const [stats, setStats] = useState({ totalUsers: 0, totalUrls: 0, totalClicks: 0 });
  const [users, setUsers] = useState([]);
  const [links, setLinks] = useState([]);
  const [settings, setSettings] = useState({
    requireEmailVerification: true,
    emailConfigured: false,
  });
  const [loading, setLoading] = useState(true);
  const [linkSearch, setLinkSearch] = useState('');
  const [expandedUserId, setExpandedUserId] = useState(null);

  // Email configuration state
  const [emailForm, setEmailForm] = useState({
    emailProvider: 'gmail',
    emailUsername: '',
    emailPassword: '',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');

  // Create User Modal state
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user',
    firstName: '',
    lastName: '',
    phone: '',
    company: '',
    website: '',
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  // Ban User Modal state
  const [banModalUser, setBanModalUser] = useState(null);

  // Unban User Modal state
  const [unbanModalUser, setUnbanModalUser] = useState(null);

  // Refreshing state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Ban History and Appeals state
  const [userBanHistory, setUserBanHistory] = useState({});
  const [userAppeals, setUserAppeals] = useState({});
  const [loadingHistory, setLoadingHistory] = useState({});
  const [expandedSection, setExpandedSection] = useState({}); // { [userId]: 'history' | 'appeals' | null }

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/admin/stats');
      setStats(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data);
      setLoading(false);
    } catch (error) {
      console.error(error);
      showToast.error('Failed to load users');
      setLoading(false);
    }
  };

  const fetchLinks = async () => {
    try {
      const { data } = await api.get(`/admin/links?search=${linkSearch}`);
      setLinks(data.urls);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/admin/settings');
      setSettings(data);
      // Populate email form with existing data (password will be masked)
      if (data.emailUsername) {
        setEmailForm({
          emailProvider: data.emailProvider || 'gmail',
          emailUsername: data.emailUsername || '',
          emailPassword: '', // Don't populate password for security
          smtpHost: data.smtpHost || '',
          smtpPort: data.smtpPort || 587,
          smtpSecure: data.smtpSecure || false,
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchUserBanHistory = async (userId) => {
    if (userBanHistory[userId]) return; // Already loaded

    setLoadingHistory((prev) => ({ ...prev, [userId]: 'history' }));
    try {
      const { data } = await api.get(`/admin/users/${userId}/ban-history`);
      setUserBanHistory((prev) => ({ ...prev, [userId]: data }));
    } catch (error) {
      console.error('Failed to fetch ban history:', error);
    } finally {
      setLoadingHistory((prev) => ({ ...prev, [userId]: null }));
    }
  };

  const fetchUserAppeals = async (userId, forceRefresh = false) => {
    if (userAppeals[userId] && !forceRefresh) return; // Already loaded

    setLoadingHistory((prev) => ({ ...prev, [userId]: 'appeals' }));
    try {
      const { data } = await api.get(`/admin/users/${userId}/appeals`);
      setUserAppeals((prev) => ({ ...prev, [userId]: data }));
    } catch (error) {
      console.error('Failed to fetch appeals:', error);
    } finally {
      setLoadingHistory((prev) => ({ ...prev, [userId]: null }));
    }
  };

  const handleToggleSection = (userId, section) => {
    const currentSection = expandedSection[userId];
    if (currentSection === section) {
      setExpandedSection((prev) => ({ ...prev, [userId]: null }));
    } else {
      setExpandedSection((prev) => ({ ...prev, [userId]: section }));
      if (section === 'history') {
        fetchUserBanHistory(userId);
      } else if (section === 'appeals') {
        fetchUserAppeals(userId);
      }
    }
  };

  const handleRespondToAppeal = async (appealId, status, unbanUser = false) => {
    const response = await prompt({
      title: status === 'approved' ? 'Approve Appeal' : 'Reject Appeal',
      message:
        status === 'approved'
          ? 'Enter a response message for the user (optional):'
          : 'Please provide a reason for rejecting this appeal:',
      placeholder:
        status === 'approved'
          ? 'Your account has been reinstated...'
          : 'Your appeal was rejected because...',
      variant: status === 'approved' ? 'success' : 'error',
      confirmText: status === 'approved' ? 'Approve' : 'Reject',
      required: status === 'rejected',
      multiline: true,
    });

    // User cancelled the dialog
    if (response === null) return;

    try {
      await api.patch(`/admin/appeals/${appealId}`, {
        status,
        adminResponse: response || undefined,
        unbanUser: status === 'approved' ? unbanUser : false,
      });

      showToast.success(
        `Appeal ${status}${status === 'approved' && unbanUser ? ' and user unbanned' : ''}`,
        'Appeal Updated'
      );

      // Refresh appeals and users
      const userId = Object.keys(userAppeals).find((uid) =>
        userAppeals[uid]?.some((a) => a._id === appealId)
      );
      if (userId) {
        // Clear cached data and force refresh
        setUserAppeals((prev) => ({ ...prev, [userId]: undefined }));
        // Use setTimeout to ensure state is updated before fetching
        setTimeout(() => fetchUserAppeals(userId, true), 100);
      }

      if (status === 'approved' && unbanUser) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Failed to respond to appeal:', error);
      showToast.error(error.response?.data?.message || 'Failed to update appeal');
    }
  };

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchSettings();
  }, []);

  // Handle refresh all data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchUsers(),
        activeTab === 'links' ? fetchLinks() : Promise.resolve(),
        activeTab === 'settings' ? fetchSettings() : Promise.resolve(),
      ]);

      // Clear cached ban history and appeals
      setUserBanHistory({});
      setUserAppeals({});

      // Re-fetch data for any currently expanded sections
      Object.entries(expandedSection).forEach(([userId, section]) => {
        if (section === 'history') {
          // Use setTimeout to ensure state is cleared before re-fetching
          setTimeout(() => fetchUserBanHistory(userId), 50);
        } else if (section === 'appeals') {
          setTimeout(() => fetchUserAppeals(userId, true), 50);
        }
      });

      showToast.success('Data refreshed successfully', 'Refreshed');
    } catch {
      showToast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch links when tab changes to links
  useEffect(() => {
    if (activeTab === 'links') {
      fetchLinks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, linkSearch]);

  // --- User Actions ---
  const handleToggleUserStatus = async (userId, currentStatus) => {
    // If banning (currentStatus is true), show the ban modal
    if (currentStatus) {
      const user = users.find((u) => u._id === userId);
      if (user) {
        setBanModalUser(user);
      }
      return;
    }

    // If activating (currentStatus is false), show the unban modal
    const user = users.find((u) => u._id === userId);
    if (user) {
      setUnbanModalUser(user);
    }
  };

  // Handle unban confirmation from modal
  const handleUnbanUser = async ({ reenableLinks }) => {
    if (!unbanModalUser) return;

    try {
      const { data } = await api.patch(`/admin/users/${unbanModalUser._id}/status`, {
        reenableLinks,
      });
      showToast.success(
        `User has been activated${reenableLinks ? ' and their links re-enabled' : ''}`,
        'User Activated'
      );
      // Use the response data from API to ensure all ban fields are properly cleared
      setUsers(
        users.map((u) =>
          u._id === unbanModalUser._id
            ? { ...u, ...data.user }
            : u
        )
      );
      setUnbanModalUser(null);
      // Refresh links if on links tab to show updated status
      if (activeTab === 'links') {
        fetchLinks();
      }
    } catch (error) {
      console.error(error);
      showToast.error(error.response?.data?.message || 'Failed to activate user');
    }
  };

  // Handle ban confirmation from modal
  const handleBanUser = async ({ reason, disableLinks, duration }) => {
    if (!banModalUser) return;

    try {
      const { data } = await api.patch(`/admin/users/${banModalUser._id}/status`, {
        reason,
        disableLinks,
        duration,
      });
      const durationText = duration && duration !== 'permanent' ? ` for ${duration}` : '';
      showToast.success(
        `User has been banned${durationText}${disableLinks ? ' and their links disabled' : ''}`,
        'User Banned'
      );
      // Use the response data from API which includes bannedUntil, bannedAt, etc.
      setUsers(
        users.map((u) =>
          u._id === banModalUser._id
            ? { ...u, ...data.user }
            : u
        )
      );
      setBanModalUser(null);
      // Refresh links if on links tab to show updated status
      if (activeTab === 'links') {
        fetchLinks();
      }
    } catch (error) {
      console.error(error);
      showToast.error(error.response?.data?.message || 'Failed to ban user');
    }
  };

  const handleDeleteUser = async (userId) => {
    const confirmed = await confirm({
      title: 'Delete User Permanently?',
      message:
        'This will permanently delete the user account along with ALL their links and analytics data. This action cannot be undone.',
      confirmText: 'Delete Forever',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      showToast.success('User and all associated data removed', 'User Deleted');
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error(error);
      showToast.error('Failed to delete user');
    }
  };

  const handleToggleUserRole = async (userId, currentRole) => {
    const isPromoting = currentRole !== 'admin';
    const confirmed = await confirm({
      title: isPromoting ? 'Promote to Admin?' : 'Demote to User?',
      message: isPromoting
        ? 'This user will gain full admin privileges including access to user management and system settings.'
        : 'This user will lose admin privileges and become a regular user.',
      confirmText: isPromoting ? 'Promote' : 'Demote',
      variant: isPromoting ? 'promote' : 'demote',
    });
    if (!confirmed) return;

    try {
      const { data } = await api.patch(`/admin/users/${userId}/role`);
      showToast.success(
        currentRole === 'admin' ? 'User demoted successfully' : 'User promoted to admin',
        'Role Updated'
      );
      setUsers(users.map((u) => (u._id === userId ? { ...u, role: data.user.role } : u)));
    } catch (error) {
      console.error(error);
      showToast.error(error.response?.data?.message || 'Failed to update user role');
    }
  };

  // --- Create User Actions ---
  const handleCreateUser = async (e) => {
    e.preventDefault();

    // Validation
    if (!createUserForm.email || !createUserForm.password) {
      showToast.warning('Please fill in all required fields', 'Missing Fields');
      return;
    }

    if (createUserForm.password !== createUserForm.confirmPassword) {
      showToast.error('Passwords do not match', 'Validation Error');
      return;
    }

    if (createUserForm.password.length < 6) {
      showToast.warning('Password must be at least 6 characters', 'Weak Password');
      return;
    }

    setCreatingUser(true);
    try {
      await api.post('/admin/users', {
        email: createUserForm.email,
        password: createUserForm.password,
        role: createUserForm.role,
        firstName: createUserForm.firstName || undefined,
        lastName: createUserForm.lastName || undefined,
        phone: createUserForm.phone || undefined,
        company: createUserForm.company || undefined,
        website: createUserForm.website || undefined,
      });

      showToast.success(
        `${createUserForm.role === 'admin' ? 'Admin' : 'User'} account created successfully`,
        'User Created'
      );

      // Reset form and close modal
      setCreateUserForm({
        email: '',
        password: '',
        confirmPassword: '',
        role: 'user',
        firstName: '',
        lastName: '',
        phone: '',
        company: '',
        website: '',
      });
      setShowCreateUserModal(false);
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error(error);
      showToast.error(error.response?.data?.message || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const closeCreateUserModal = () => {
    setShowCreateUserModal(false);
    setCreateUserForm({
      email: '',
      password: '',
      confirmPassword: '',
      role: 'user',
      firstName: '',
      lastName: '',
      phone: '',
      company: '',
      website: '',
    });
    setShowCreatePassword(false);
  };

  // --- Link Actions ---
  const handleToggleLinkStatus = async (linkId, currentStatus) => {
    try {
      await api.patch(`/admin/links/${linkId}/status`);
      showToast.success(
        `Link has been ${currentStatus ? 'disabled' : 'activated'}`,
        'Link Updated'
      );
      setLinks(links.map((l) => (l._id === linkId ? { ...l, isActive: !l.isActive } : l)));
    } catch (error) {
      console.error(error);
      showToast.error('Failed to update link status');
    }
  };

  const handleDeleteLink = async (linkId) => {
    const confirmed = await confirm({
      title: 'Delete Link?',
      message:
        'This link will be permanently deleted along with all its analytics data. This action cannot be undone.',
      confirmText: 'Delete Link',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await api.delete(`/admin/links/${linkId}`);
      showToast.success('Link permanently removed', 'Link Deleted');
      setLinks(links.filter((l) => l._id !== linkId));
      fetchStats();
    } catch (error) {
      console.error(error);
      showToast.error('Failed to delete link');
    }
  };

  // --- Settings Actions ---
  const handleToggleVerification = async () => {
    try {
      const newValue = !settings.requireEmailVerification;
      const { data } = await api.patch('/admin/settings', { requireEmailVerification: newValue });
      setSettings(data);
      showToast.success(
        `Email verification is now ${newValue ? 'required' : 'optional'} for new users`,
        'Settings Updated'
      );
    } catch (error) {
      console.error(error);
      showToast.error('Failed to update settings');
    }
  };

  const handleSaveEmailConfig = async (e) => {
    e.preventDefault();
    if (!emailForm.emailUsername) {
      showToast.warning('Please enter your email address', 'Missing Field');
      return;
    }
    // Only require password if not already configured or if updating
    if (!settings.emailConfigured && !emailForm.emailPassword) {
      showToast.warning('Please enter your email password or app password', 'Missing Field');
      return;
    }
    // Validate SMTP fields if custom SMTP is selected
    if (emailForm.emailProvider === 'smtp') {
      if (!emailForm.smtpHost) {
        showToast.warning('Please enter SMTP host', 'Missing Field');
        return;
      }
      if (!emailForm.smtpPort) {
        showToast.warning('Please enter SMTP port', 'Missing Field');
        return;
      }
    }

    setSavingEmail(true);
    try {
      const payload = {
        emailProvider: emailForm.emailProvider,
        emailUsername: emailForm.emailUsername,
      };
      // Only send password if provided (for updates, password is optional)
      if (emailForm.emailPassword) {
        payload.emailPassword = emailForm.emailPassword;
      }
      // Include SMTP settings if custom SMTP is selected
      if (emailForm.emailProvider === 'smtp') {
        payload.smtpHost = emailForm.smtpHost;
        payload.smtpPort = parseInt(emailForm.smtpPort, 10);
        payload.smtpSecure = emailForm.smtpSecure;
      }

      const { data } = await api.patch('/admin/settings', payload);
      setSettings(data);
      setEmailForm((prev) => ({ ...prev, emailPassword: '' })); // Clear password field
      showToast.success('Your email settings have been saved securely', 'Email Configured');
    } catch (error) {
      console.error(error);
      showToast.error(error.response?.data?.message || 'Failed to save email configuration');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailAddress) {
      showToast.warning('Enter an email address to send test', 'Missing Email');
      return;
    }
    if (!settings.emailConfigured) {
      showToast.warning('Save your email configuration first', 'Not Configured');
      return;
    }

    setTestingEmail(true);
    try {
      await api.post('/admin/settings/test-email', { email: testEmailAddress });
      showToast.success('Check your inbox for the test email', 'Email Sent');
    } catch (error) {
      console.error(error);
      showToast.error(error.response?.data?.message || 'Failed to send test email');
    } finally {
      setTestingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 p-3 sm:p-4 lg:p-6 rounded-xl sm:rounded-2xl">
          <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2">
            <div className="text-center sm:text-left">
              <p className="text-gray-400 text-xs sm:text-sm font-medium">Users</p>
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mt-0.5 sm:mt-1">
                {stats.totalUsers}
              </h3>
            </div>
            <div className="p-2 sm:p-3 bg-purple-500/20 rounded-lg sm:rounded-xl hidden sm:block">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 p-3 sm:p-4 lg:p-6 rounded-xl sm:rounded-2xl">
          <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2">
            <div className="text-center sm:text-left">
              <p className="text-gray-400 text-xs sm:text-sm font-medium">Links</p>
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mt-0.5 sm:mt-1">
                {stats.totalUrls}
              </h3>
            </div>
            <div className="p-2 sm:p-3 bg-pink-500/20 rounded-lg sm:rounded-xl hidden sm:block">
              <LinkIcon className="w-5 h-5 sm:w-6 sm:h-6 text-pink-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 p-3 sm:p-4 lg:p-6 rounded-xl sm:rounded-2xl">
          <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2">
            <div className="text-center sm:text-left">
              <p className="text-gray-400 text-xs sm:text-sm font-medium">Clicks</p>
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mt-0.5 sm:mt-1">
                {stats.totalClicks}
              </h3>
            </div>
            <div className="p-2 sm:p-3 bg-blue-500/20 rounded-lg sm:rounded-xl hidden sm:block">
              <BarChart2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-700 pb-3 sm:pb-0">
        <div className="flex overflow-x-auto scrollbar-hide -mx-1 px-1 sm:mx-0 sm:px-0">
          <button
            className={`pb-2 px-3 sm:px-4 font-medium transition-colors whitespace-nowrap text-sm sm:text-base ${
              activeTab === 'users'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button
            className={`pb-2 px-3 sm:px-4 font-medium transition-colors whitespace-nowrap text-sm sm:text-base ${
              activeTab === 'links'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('links')}
          >
            <span className="hidden sm:inline">Links & Moderation</span>
            <span className="sm:hidden">Links</span>
          </button>
          <button
            className={`pb-2 px-3 sm:px-4 font-medium transition-colors whitespace-nowrap text-sm sm:text-base ${
              activeTab === 'settings'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={loading || isRefreshing}
          className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 w-full sm:w-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-xl sm:rounded-2xl overflow-hidden min-h-[300px] sm:min-h-[400px]">
        {/* USERS TAB */}
        {activeTab === 'users' && (
          <>
            <div className="p-4 sm:p-6 border-b border-gray-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-white">User Management</h2>
              <button
                onClick={() => setShowCreateUserModal(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm sm:text-base font-medium rounded-xl transition-all w-full sm:w-auto justify-center"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Create User</span>
                <span className="sm:hidden">Add User</span>
              </button>
            </div>

            {/* Mobile Card View for Users */}
            <div className="md:hidden p-3 space-y-3">
              {users.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Users className="w-12 h-12 text-gray-600" />
                  <p className="text-gray-400 font-medium">No users found</p>
                  <p className="text-gray-500 text-sm">Users will appear here once they register</p>
                </div>
              ) : (
                users.map((user) => (
                  <div
                    key={user._id}
                    className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden"
                  >
                    {/* User Header */}
                    <div
                      className="p-3 flex items-center gap-3 cursor-pointer"
                      onClick={() =>
                        setExpandedUserId(expandedUserId === user._id ? null : user._id)
                      }
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                        {user.firstName
                          ? user.firstName[0].toUpperCase()
                          : user.email[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{user.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              user.role === 'admin'
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'bg-gray-700 text-gray-300'
                            }`}
                          >
                            {user.role}
                          </span>
                          {user.isActive !== false ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-300">
                              Active
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-300">
                              Banned
                            </span>
                          )}
                        </div>
                      </div>
                      <button className="p-1.5 hover:bg-gray-700/50 rounded-lg">
                        {expandedUserId === user._id ? (
                          <ChevronUp size={16} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={16} className="text-gray-400" />
                        )}
                      </button>
                    </div>

                    {/* Expanded Content */}
                    {expandedUserId === user._id && (
                      <div className="border-t border-gray-700/50">
                        {/* User Details */}
                        <div className="p-3 space-y-2 text-sm">
                          {(user.firstName || user.lastName) && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Name</span>
                              <span className="text-white">
                                {user.firstName} {user.lastName}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-500">Joined</span>
                            <span className="text-gray-300">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {user.bannedUntil && user.isActive === false && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Unbans</span>
                              <span className="text-orange-400">
                                {new Date(user.bannedUntil).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {user.phone && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Phone</span>
                              <span className="text-gray-300">{user.phone}</span>
                            </div>
                          )}
                          {user.company && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Company</span>
                              <span className="text-gray-300">{user.company}</span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div
                          className="p-3 pt-0 flex flex-wrap gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleToggleUserRole(user._id, user.role)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              user.role === 'admin'
                                ? 'bg-orange-500/20 text-orange-300 hover:bg-orange-500/30'
                                : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
                            }`}
                          >
                            {user.role === 'admin' ? (
                              <ShieldAlert size={12} />
                            ) : (
                              <Shield size={12} />
                            )}
                            {user.role === 'admin' ? 'Demote' : 'Promote'}
                          </button>
                          {user.role !== 'admin' && (
                            <>
                              <button
                                onClick={() =>
                                  handleToggleUserStatus(user._id, user.isActive !== false)
                                }
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  user.isActive !== false
                                    ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30'
                                    : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                                }`}
                              >
                                {user.isActive !== false ? (
                                  <Ban size={12} />
                                ) : (
                                  <CheckCircle size={12} />
                                )}
                                {user.isActive !== false ? 'Ban' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user._id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                              >
                                <Trash2 size={12} />
                                Delete
                              </button>
                            </>
                          )}
                        </div>

                        {/* History/Appeals Buttons */}
                        <div className="px-3 pb-3 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSection(user._id, 'history');
                            }}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              expandedSection[user._id] === 'history'
                                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                                : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                            }`}
                          >
                            <History size={12} />
                            History
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSection(user._id, 'appeals');
                            }}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              expandedSection[user._id] === 'appeals'
                                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                            }`}
                          >
                            <FileText size={12} />
                            Appeals
                          </button>
                        </div>

                        {/* Ban History Panel - Mobile */}
                        {expandedSection[user._id] === 'history' && (
                          <div className="mx-3 mb-3 bg-gray-800/30 rounded-lg border border-gray-700/50 p-3">
                            <h4 className="text-xs font-medium text-white mb-2 flex items-center gap-1.5">
                              <History size={12} className="text-orange-400" />
                              Ban History
                            </h4>
                            {loadingHistory[user._id] === 'history' ? (
                              <div className="flex justify-center py-3">
                                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                              </div>
                            ) : userBanHistory[user._id]?.length > 0 ? (
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {userBanHistory[user._id].map((entry, idx) => (
                                  <div
                                    key={entry._id || idx}
                                    className={`p-2 rounded-lg text-xs ${
                                      entry.action === 'ban'
                                        ? 'bg-red-500/10 border border-red-500/20'
                                        : 'bg-green-500/10 border border-green-500/20'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span
                                        className={`font-medium ${
                                          entry.action === 'ban' ? 'text-red-300' : 'text-green-300'
                                        }`}
                                      >
                                        {entry.action === 'ban' ? 'Banned' : 'Unbanned'}
                                      </span>
                                      <span className="text-gray-500 text-[10px]">
                                        {new Date(entry.createdAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                    {entry.reason && (
                                      <p className="text-gray-400 mt-1 line-clamp-2">
                                        {entry.reason}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500 text-center py-2">No history</p>
                            )}
                          </div>
                        )}

                        {/* Appeals Panel - Mobile */}
                        {expandedSection[user._id] === 'appeals' && (
                          <div className="mx-3 mb-3 bg-gray-800/30 rounded-lg border border-gray-700/50 p-3">
                            <h4 className="text-xs font-medium text-white mb-2 flex items-center gap-1.5">
                              <FileText size={12} className="text-violet-400" />
                              Appeals
                            </h4>
                            {loadingHistory[user._id] === 'appeals' ? (
                              <div className="flex justify-center py-3">
                                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                              </div>
                            ) : userAppeals[user._id]?.length > 0 ? (
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {userAppeals[user._id].map((appeal) => (
                                  <div
                                    key={appeal._id}
                                    className={`p-2 rounded-lg text-xs border ${
                                      appeal.status === 'pending'
                                        ? 'bg-yellow-500/10 border-yellow-500/20'
                                        : appeal.status === 'approved'
                                          ? 'bg-green-500/10 border-green-500/20'
                                          : 'bg-red-500/10 border-red-500/20'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <span
                                        className={`font-medium capitalize ${
                                          appeal.status === 'pending'
                                            ? 'text-yellow-300'
                                            : appeal.status === 'approved'
                                              ? 'text-green-300'
                                              : 'text-red-300'
                                        }`}
                                      >
                                        {appeal.status}
                                      </span>
                                      <span className="text-gray-500 text-[10px]">
                                        {new Date(appeal.createdAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <p className="text-gray-300 line-clamp-2">{appeal.reason}</p>
                                    {appeal.status === 'pending' && (
                                      <div className="flex gap-1.5 mt-2">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRespondToAppeal(appeal._id, 'approved', true);
                                          }}
                                          className="flex-1 px-2 py-1 bg-green-500/20 text-green-300 rounded text-[10px] font-medium"
                                        >
                                          Approve & Unban
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRespondToAppeal(appeal._id, 'rejected');
                                          }}
                                          className="flex-1 px-2 py-1 bg-red-500/20 text-red-300 rounded text-[10px] font-medium"
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500 text-center py-2">No appeals</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table View for Users */}
            <div className="hidden md:block overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="bg-gray-800/80 text-gray-400 text-sm uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium w-10"></th>
                    <th className="px-6 py-4 font-medium">User</th>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Role</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Joined</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Users className="w-12 h-12 text-gray-600" />
                          <p className="text-gray-400 font-medium">No users found</p>
                          <p className="text-gray-500 text-sm">
                            Users will appear here once they register
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {users.map((user) => (
                    <Fragment key={user._id}>
                      <tr
                        className="hover:bg-gray-700/30 transition-colors cursor-pointer"
                        onClick={() =>
                          setExpandedUserId(expandedUserId === user._id ? null : user._id)
                        }
                      >
                        <td className="px-6 py-4">
                          <button className="p-1 hover:bg-gray-700/50 rounded transition-colors">
                            {expandedUserId === user._id ? (
                              <ChevronUp size={16} className="text-gray-400" />
                            ) : (
                              <ChevronDown size={16} className="text-gray-400" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-sm font-bold text-white">
                              {user.firstName
                                ? user.firstName[0].toUpperCase()
                                : user.email[0].toUpperCase()}
                            </div>
                            <span className="text-white font-medium">{user.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {user.firstName || user.lastName ? (
                            <span className="text-white">
                              {user.firstName} {user.lastName}
                            </span>
                          ) : (
                            <span className="text-gray-500 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              user.role === 'admin'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-gray-700 text-gray-300'
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {user.isActive !== false ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-300 border border-green-500/30">
                              Active
                            </span>
                          ) : user.bannedReason && user.bannedReason.includes('Unban Pending') ? (
                            <span
                              className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30 cursor-help"
                              title={user.bannedReason}
                            >
                              Unban Pending
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30 w-fit">
                                Banned
                              </span>
                              {user.bannedUntil ? (
                                <div
                                  className="flex items-center gap-1 text-[10px] text-orange-400"
                                  title={`Unbans: ${new Date(user.bannedUntil).toLocaleString()}`}
                                >
                                  <Timer size={10} />
                                  <span>{new Date(user.bannedUntil).toLocaleDateString()}</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-red-400">Permanent</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-sm">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div
                            className="flex items-center justify-end gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Promote/Demote Button */}
                            <button
                              onClick={() => handleToggleUserRole(user._id, user.role)}
                              className={`p-2 rounded-lg transition-colors ${
                                user.role === 'admin'
                                  ? 'hover:bg-orange-500/20 text-gray-400 hover:text-orange-400'
                                  : 'hover:bg-purple-500/20 text-gray-400 hover:text-purple-400'
                              }`}
                              title={user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                            >
                              {user.role === 'admin' ? (
                                <ShieldAlert className="w-4 h-4" />
                              ) : (
                                <Shield className="w-4 h-4" />
                              )}
                            </button>
                            {/* Ban/Activate Button - not for admins */}
                            {user.role !== 'admin' && (
                              <button
                                onClick={() =>
                                  handleToggleUserStatus(user._id, user.isActive !== false)
                                }
                                className={`p-2 rounded-lg transition-colors ${
                                  user.isActive !== false
                                    ? 'hover:bg-yellow-500/20 text-gray-400 hover:text-yellow-400'
                                    : 'hover:bg-green-500/20 text-gray-400 hover:text-green-400'
                                }`}
                                title={user.isActive !== false ? 'Ban User' : 'Activate User'}
                              >
                                {user.isActive !== false ? (
                                  <Ban className="w-4 h-4" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            {/* Delete Button - not for admins */}
                            {user.role !== 'admin' && (
                              <button
                                onClick={() => handleDeleteUser(user._id)}
                                className="p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                                title="Delete User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Expanded User Details */}
                      {expandedUserId === user._id && (
                        <tr className="bg-gray-800/30">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              {/* Phone */}
                              <div className="flex items-center gap-3 bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                                <div className="p-2 bg-blue-500/20 rounded-lg">
                                  <Phone size={16} className="text-blue-400" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Phone</p>
                                  <p className="text-sm text-white">
                                    {user.phone || (
                                      <span className="text-gray-600">Not provided</span>
                                    )}
                                  </p>
                                </div>
                              </div>

                              {/* Company */}
                              <div className="flex items-center gap-3 bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                                <div className="p-2 bg-purple-500/20 rounded-lg">
                                  <Building2 size={16} className="text-purple-400" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Company</p>
                                  <p className="text-sm text-white">
                                    {user.company || (
                                      <span className="text-gray-600">Not provided</span>
                                    )}
                                  </p>
                                </div>
                              </div>

                              {/* Website */}
                              <div className="flex items-center gap-3 bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                                <div className="p-2 bg-green-500/20 rounded-lg">
                                  <Globe size={16} className="text-green-400" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Website</p>
                                  {user.website ? (
                                    <a
                                      href={user.website}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-green-400 hover:underline truncate block max-w-[150px]"
                                    >
                                      {user.website.replace(/^https?:\/\//, '')}
                                    </a>
                                  ) : (
                                    <p className="text-sm text-gray-600">Not provided</p>
                                  )}
                                </div>
                              </div>

                              {/* Last Login */}
                              <div className="flex items-center gap-3 bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                                <div className="p-2 bg-orange-500/20 rounded-lg">
                                  <Clock size={16} className="text-orange-400" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Last Login</p>
                                  <p className="text-sm text-white">
                                    {user.lastLoginAt ? (
                                      new Date(user.lastLoginAt).toLocaleString()
                                    ) : (
                                      <span className="text-gray-600">Never</span>
                                    )}
                                  </p>
                                </div>
                              </div>

                              {/* Bio - Full width */}
                              {user.bio && (
                                <div className="md:col-span-2 lg:col-span-4 flex items-start gap-3 bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                                  <div className="p-2 bg-pink-500/20 rounded-lg">
                                    <User size={16} className="text-pink-400" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Bio</p>
                                    <p className="text-sm text-gray-300">{user.bio}</p>
                                  </div>
                                </div>
                              )}

                              {/* Verification Status */}
                              <div className="flex items-center gap-3 bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                                <div
                                  className={`p-2 rounded-lg ${
                                    user.isVerified ? 'bg-green-500/20' : 'bg-yellow-500/20'
                                  }`}
                                >
                                  {user.isVerified ? (
                                    <CheckCircle2 size={16} className="text-green-400" />
                                  ) : (
                                    <AlertCircle size={16} className="text-yellow-400" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Email Status</p>
                                  <p
                                    className={`text-sm ${
                                      user.isVerified ? 'text-green-400' : 'text-yellow-400'
                                    }`}
                                  >
                                    {user.isVerified ? 'Verified' : 'Unverified'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Ban History and Appeals Section */}
                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleSection(user._id, 'history');
                                }}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                  expandedSection[user._id] === 'history'
                                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700'
                                }`}
                              >
                                <History size={14} />
                                Ban History
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleSection(user._id, 'appeals');
                                }}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                  expandedSection[user._id] === 'appeals'
                                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700'
                                }`}
                              >
                                <FileText size={14} />
                                Appeals
                              </button>
                            </div>

                            {/* Ban History Panel */}
                            {expandedSection[user._id] === 'history' && (
                              <div className="mt-4 bg-gray-800/30 rounded-xl border border-gray-700/50 p-4">
                                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                                  <History size={14} className="text-orange-400" />
                                  Ban History
                                </h4>
                                {loadingHistory[user._id] === 'history' ? (
                                  <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                                  </div>
                                ) : userBanHistory[user._id]?.length > 0 ? (
                                  <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                                    {userBanHistory[user._id].map((entry, idx) => (
                                      <div
                                        key={entry._id || idx}
                                        className={`p-3 rounded-lg border ${
                                          entry.action === 'ban'
                                            ? 'bg-red-500/10 border-red-500/20'
                                            : 'bg-green-500/10 border-green-500/20'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                              <span
                                                className={`text-xs font-medium px-2 py-0.5 rounded ${
                                                  entry.action === 'ban'
                                                    ? 'bg-red-500/20 text-red-300'
                                                    : 'bg-green-500/20 text-green-300'
                                                }`}
                                              >
                                                {entry.action === 'ban' ? 'Banned' : 'Unbanned'}
                                              </span>
                                              {entry.duration && entry.duration !== 'permanent' && (
                                                <span className="text-xs text-orange-300">
                                                  ({entry.duration})
                                                </span>
                                              )}
                                            </div>
                                            {entry.reason && (
                                              <p className="text-xs text-gray-400 mt-1">
                                                {entry.reason}
                                              </p>
                                            )}
                                            <p className="text-xs text-gray-500 mt-1">
                                              By: {entry.performedBy?.email || 'System'}
                                            </p>
                                          </div>
                                          <span className="text-xs text-gray-500 whitespace-nowrap">
                                            {new Date(entry.createdAt).toLocaleString()}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 text-center py-4">
                                    No ban history found
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Appeals Panel */}
                            {expandedSection[user._id] === 'appeals' && (
                              <div className="mt-4 bg-gray-800/30 rounded-xl border border-gray-700/50 p-4">
                                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                                  <FileText size={14} className="text-violet-400" />
                                  Appeals
                                </h4>
                                {loadingHistory[user._id] === 'appeals' ? (
                                  <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                                  </div>
                                ) : userAppeals[user._id]?.length > 0 ? (
                                  <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                                    {userAppeals[user._id].map((appeal) => (
                                      <div
                                        key={appeal._id}
                                        className={`p-3 rounded-lg border ${
                                          appeal.status === 'pending'
                                            ? 'bg-yellow-500/10 border-yellow-500/20'
                                            : appeal.status === 'approved'
                                              ? 'bg-green-500/10 border-green-500/20'
                                              : 'bg-red-500/10 border-red-500/20'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                          <span
                                            className={`text-xs font-medium px-2 py-0.5 rounded ${
                                              appeal.status === 'pending'
                                                ? 'bg-yellow-500/20 text-yellow-300'
                                                : appeal.status === 'approved'
                                                  ? 'bg-green-500/20 text-green-300'
                                                  : 'bg-red-500/20 text-red-300'
                                            }`}
                                          >
                                            {appeal.status.charAt(0).toUpperCase() +
                                              appeal.status.slice(1)}
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            {new Date(appeal.createdAt).toLocaleString()}
                                          </span>
                                        </div>
                                        <div className="bg-gray-800/50 rounded p-2 mb-2">
                                          <p className="text-xs text-gray-300">{appeal.message}</p>
                                        </div>
                                        {appeal.bannedReason && (
                                          <p className="text-xs text-gray-500 mb-2">
                                            <span className="text-gray-400">Ban reason:</span>{' '}
                                            {appeal.bannedReason}
                                          </p>
                                        )}
                                        {appeal.adminResponse && (
                                          <div className="bg-gray-700/30 rounded p-2 mb-2">
                                            <p className="text-xs text-gray-500">Admin response:</p>
                                            <p className="text-xs text-gray-300">
                                              {appeal.adminResponse}
                                            </p>
                                          </div>
                                        )}
                                        {appeal.status === 'pending' && (
                                          <div className="flex gap-2 mt-2">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleRespondToAppeal(appeal._id, 'approved', true);
                                              }}
                                              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs rounded-lg transition-colors"
                                            >
                                              <CheckCircle size={12} />
                                              Approve & Unban
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleRespondToAppeal(
                                                  appeal._id,
                                                  'approved',
                                                  false
                                                );
                                              }}
                                              className="px-2 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs rounded-lg transition-colors"
                                            >
                                              Approve Only
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleRespondToAppeal(appeal._id, 'rejected');
                                              }}
                                              className="px-2 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs rounded-lg transition-colors"
                                            >
                                              Reject
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 text-center py-4">
                                    No appeals found
                                  </p>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* LINKS TAB */}
        {activeTab === 'links' && (
          <>
            <div className="p-4 sm:p-6 border-b border-gray-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
              <h2 className="text-lg sm:text-xl font-bold text-white">Link Management</h2>
              <div className="relative w-full sm:w-64">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Search URL, ID, or Title..."
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Mobile Card View for Links */}
            <div className="md:hidden p-3 space-y-3">
              {links.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <LinkIcon className="w-12 h-12 text-gray-600" />
                  <p className="text-gray-400 font-medium">No links found</p>
                  <p className="text-gray-500 text-sm text-center">
                    {linkSearch
                      ? 'Try a different search term'
                      : 'Links will appear here once users create them'}
                  </p>
                </div>
              ) : (
                links.map((link) => {
                  const isOwnerBanned = link.ownerBanned;
                  const isDisabledByAdmin = !link.isActive;
                  const isEffectivelyDisabled = isOwnerBanned || isDisabledByAdmin;

                  return (
                    <div
                      key={link._id}
                      className={`bg-gray-800/30 border rounded-xl overflow-hidden ${
                        isOwnerBanned
                          ? 'border-orange-500/30 bg-orange-500/5'
                          : 'border-gray-700/50'
                      }`}
                    >
                      {/* Link Header */}
                      <div className="p-3">
                        {/* Short ID and Status */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono text-sm font-medium ${
                                isEffectivelyDisabled ? 'text-gray-500' : 'text-blue-400'
                              }`}
                            >
                              /{link.shortId}
                            </span>
                            {link.customAlias && (
                              <span
                                className={`flex items-center gap-1 font-mono text-xs ${
                                  isEffectivelyDisabled ? 'text-gray-500' : 'text-purple-400'
                                }`}
                              >
                                <Sparkles size={10} />/{link.customAlias}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                link.isActive
                                  ? 'bg-green-500/20 text-green-300'
                                  : 'bg-red-500/20 text-red-300'
                              }`}
                            >
                              {link.isActive ? 'Active' : 'Disabled'}
                            </span>
                          </div>
                        </div>

                        {/* Original URL */}
                        <p
                          className={`text-xs truncate mb-2 ${
                            isEffectivelyDisabled ? 'text-gray-500' : 'text-gray-300'
                          }`}
                          title={link.originalUrl}
                        >
                          → {link.originalUrl}
                        </p>

                        {/* Owner and Date */}
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                          <div className="flex items-center gap-1">
                            <span className="truncate max-w-[120px]">
                              {link.createdBy?.email || 'Anonymous'}
                            </span>
                            {isOwnerBanned && (
                              <span className="flex items-center gap-0.5 text-orange-400">
                                <UserX size={10} />
                                Banned
                              </span>
                            )}
                          </div>
                          <span>{new Date(link.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="px-3 pb-3 flex gap-2">
                        <a
                          href={link.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700/50 text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                          <ExternalLink size={12} />
                          Open
                        </a>
                        <button
                          onClick={() => handleToggleLinkStatus(link._id, link.isActive)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            link.isActive
                              ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30'
                              : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                          }`}
                        >
                          {link.isActive ? <ShieldAlert size={12} /> : <CheckCircle size={12} />}
                          {link.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDeleteLink(link._id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View for Links */}
            <div className="hidden md:block overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              <table className="w-full text-left min-w-[900px]">
                <thead>
                  <tr className="bg-gray-800/80 text-gray-400 text-sm uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">Short Link</th>
                    <th className="px-6 py-4 font-medium">Custom Alias</th>
                    <th className="px-6 py-4 font-medium">Original URL</th>
                    <th className="px-6 py-4 font-medium">Owner</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {links.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <LinkIcon className="w-12 h-12 text-gray-600" />
                          <p className="text-gray-400 font-medium">No links found</p>
                          <p className="text-gray-500 text-sm">
                            {linkSearch
                              ? 'Try a different search term'
                              : 'Links will appear here once users create them'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {links.map((link) => {
                    // Determine effective status
                    const isOwnerBanned = link.ownerBanned;
                    const isDisabledByAdmin = !link.isActive;
                    const isEffectivelyDisabled = isOwnerBanned || isDisabledByAdmin;

                    return (
                      <tr
                        key={link._id}
                        className={`hover:bg-gray-700/30 transition-colors ${isOwnerBanned ? 'bg-orange-500/5' : ''}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span
                              className={`font-medium font-mono ${isEffectivelyDisabled ? 'text-gray-500' : 'text-blue-400'}`}
                            >
                              /{link.shortId}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(link.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {link.customAlias ? (
                            <div className="flex items-center gap-2">
                              <Sparkles
                                size={14}
                                className={
                                  isEffectivelyDisabled ? 'text-gray-500' : 'text-purple-400'
                                }
                              />
                              <span
                                className={`font-medium font-mono ${isEffectivelyDisabled ? 'text-gray-500' : 'text-purple-400'}`}
                              >
                                /{link.customAlias}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-600 text-sm">—</span>
                          )}
                        </td>
                        <td
                          className={`px-6 py-4 max-w-xs truncate ${isEffectivelyDisabled ? 'text-gray-500' : 'text-gray-300'}`}
                          title={link.originalUrl}
                        >
                          {link.originalUrl}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-gray-400 text-sm">
                              {link.createdBy?.email || 'Anonymous'}
                            </span>
                            {isOwnerBanned && (
                              <span className="inline-flex items-center gap-1 text-xs text-orange-400">
                                <UserX size={10} />
                                Banned
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {/* Link's own status */}
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 w-fit ${
                                link.isActive
                                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
                              }`}
                            >
                              {link.isActive ? 'Active' : 'Disabled'}
                            </span>
                            {/* Owner banned indicator */}
                            {isOwnerBanned && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30 inline-flex items-center gap-1 w-fit">
                                <Ban size={10} />
                                Owner Banned
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={link.originalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => handleToggleLinkStatus(link._id, link.isActive)}
                              className={`p-2 rounded-lg transition-colors ${
                                link.isActive
                                  ? 'hover:bg-yellow-500/20 text-gray-400 hover:text-yellow-400'
                                  : 'hover:bg-green-500/20 text-gray-400 hover:text-green-400'
                              }`}
                              title={link.isActive ? 'Disable Link' : 'Enable Link'}
                            >
                              {link.isActive ? (
                                <ShieldAlert className="w-4 h-4" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteLink(link._id)}
                              className="p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                              title="Delete Permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <>
            <div className="p-4 sm:p-6 border-b border-gray-700/50">
              <h2 className="text-lg sm:text-xl font-bold text-white">System Settings</h2>
            </div>
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Email Verification Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                  <div className="p-2 sm:p-3 bg-purple-500/20 rounded-lg shrink-0">
                    <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-medium text-white">
                      Email Verification
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-400">
                      Require users to verify email before logging in.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleVerification}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors w-full sm:w-auto ${
                    settings.requireEmailVerification
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {settings.requireEmailVerification ? (
                    <>
                      <ToggleRight className="w-5 h-5" />
                      <span>Enabled</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-5 h-5" />
                      <span>Disabled</span>
                    </>
                  )}
                </button>
              </div>

              {/* Email Configuration Section */}
              <div className="p-4 sm:p-6 bg-gray-800/50 rounded-xl border border-gray-700/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-blue-500/20 rounded-lg shrink-0">
                      <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-medium text-white">
                        Email Configuration
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-400">
                        Configure SMTP for verification emails.
                      </p>
                    </div>
                  </div>
                  <span
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs sm:text-sm font-medium self-start sm:self-auto ${
                      settings.emailConfigured
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    }`}
                  >
                    {settings.emailConfigured ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Configured</span>
                        <span className="sm:hidden">OK</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Not Configured</span>
                        <span className="sm:hidden">Pending</span>
                      </>
                    )}
                  </span>
                </div>

                <form onSubmit={handleSaveEmailConfig} className="space-y-4">
                  {/* Email Provider */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email Provider
                    </label>
                    <select
                      value={emailForm.emailProvider}
                      onChange={(e) =>
                        setEmailForm({ ...emailForm, emailProvider: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl bg-gray-900/50 border border-gray-700 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="gmail">Gmail</option>
                      <option value="outlook">Outlook / Hotmail</option>
                      <option value="yahoo">Yahoo Mail</option>
                      <option value="smtp">Custom SMTP</option>
                    </select>
                    {emailForm.emailProvider === 'gmail' && (
                      <p className="mt-2 text-xs text-gray-500">
                        For Gmail, use an App Password. Enable 2FA and create one at{' '}
                        <a
                          href="https://myaccount.google.com/apppasswords"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          Google Account Settings
                        </a>
                      </p>
                    )}
                  </div>

                  {/* Custom SMTP Settings */}
                  {emailForm.emailProvider === 'smtp' && (
                    <>
                      {/* SMTP Host */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          SMTP Host
                        </label>
                        <input
                          type="text"
                          value={emailForm.smtpHost}
                          onChange={(e) => setEmailForm({ ...emailForm, smtpHost: e.target.value })}
                          placeholder="smtp.example.com"
                          className="w-full px-4 py-3 rounded-xl bg-gray-900/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>

                      {/* SMTP Port and Secure */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            SMTP Port
                          </label>
                          <input
                            type="number"
                            value={emailForm.smtpPort}
                            onChange={(e) =>
                              setEmailForm({ ...emailForm, smtpPort: e.target.value })
                            }
                            placeholder="587"
                            className="w-full px-4 py-3 rounded-xl bg-gray-900/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Use SSL/TLS
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setEmailForm({ ...emailForm, smtpSecure: !emailForm.smtpSecure })
                            }
                            className={`w-full px-4 py-3 rounded-xl border transition-all ${
                              emailForm.smtpSecure
                                ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                                : 'bg-gray-900/50 border-gray-700 text-gray-400'
                            }`}
                          >
                            {emailForm.smtpSecure
                              ? '✓ Enabled (Port 465)'
                              : '✗ Disabled (Port 587)'}
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-gray-500">
                        Common settings: Gmail (smtp.gmail.com:587), Outlook
                        (smtp-mail.outlook.com:587), SendGrid (smtp.sendgrid.net:587), Mailgun
                        (smtp.mailgun.org:587)
                      </p>
                    </>
                  )}

                  {/* Email Username */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={emailForm.emailUsername}
                      onChange={(e) =>
                        setEmailForm({ ...emailForm, emailUsername: e.target.value })
                      }
                      placeholder="your-email@gmail.com"
                      className="w-full px-4 py-3 rounded-xl bg-gray-900/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  {/* Email Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {emailForm.emailProvider === 'gmail' ? 'App Password' : 'Password'}
                      {settings.emailConfigured && (
                        <span className="text-gray-500 font-normal ml-2">
                          (leave blank to keep current)
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={emailForm.emailPassword}
                        onChange={(e) =>
                          setEmailForm({ ...emailForm, emailPassword: e.target.value })
                        }
                        placeholder={settings.emailConfigured ? '••••••••••••' : 'Enter password'}
                        className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-900/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingEmail}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingEmail ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Save Email Configuration
                      </>
                    )}
                  </button>
                </form>

                {/* Test Email Section */}
                {settings.emailConfigured && (
                  <div className="mt-6 pt-6 border-t border-gray-700/50">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">
                      Test Email Configuration
                    </h4>
                    <div className="flex gap-3">
                      <input
                        type="email"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        placeholder="Enter email to send test"
                        className="flex-1 px-4 py-3 rounded-xl bg-gray-900/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <button
                        onClick={handleTestEmail}
                        disabled={testingEmail}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {testingEmail ? (
                          <>
                            <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Send Test
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeCreateUserModal}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg bg-gray-900/95 border border-gray-700/50 rounded-2xl shadow-2xl animate-modal-in max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700/50 sticky top-0 bg-gray-900/95 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <UserPlus className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Create New User</h2>
              </div>
              <button
                onClick={closeCreateUserModal}
                className="p-2 hover:bg-gray-700/50 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateUser} className="p-6 space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={createUserForm.email}
                    onChange={(e) =>
                      setCreateUserForm({ ...createUserForm, email: e.target.value })
                    }
                    placeholder="user@example.com"
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    value={createUserForm.password}
                    onChange={(e) =>
                      setCreateUserForm({ ...createUserForm, password: e.target.value })
                    }
                    placeholder="Minimum 6 characters"
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showCreatePassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm Password <span className="text-red-400">*</span>
                </label>
                <input
                  type={showCreatePassword ? 'text' : 'password'}
                  value={createUserForm.confirmPassword}
                  onChange={(e) =>
                    setCreateUserForm({ ...createUserForm, confirmPassword: e.target.value })
                  }
                  placeholder="Confirm password"
                  className="w-full px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  required
                />
              </div>

              {/* Optional Info Divider */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700/50"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-gray-900 text-gray-500">Optional Information</span>
                </div>
              </div>

              {/* Name Fields Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">First Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={createUserForm.firstName}
                      onChange={(e) =>
                        setCreateUserForm({ ...createUserForm, firstName: e.target.value })
                      }
                      placeholder="John"
                      className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={createUserForm.lastName}
                    onChange={(e) =>
                      setCreateUserForm({ ...createUserForm, lastName: e.target.value })
                    }
                    placeholder="Doe"
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="tel"
                    value={createUserForm.phone}
                    onChange={(e) =>
                      setCreateUserForm({ ...createUserForm, phone: e.target.value })
                    }
                    placeholder="+1 (555) 000-0000"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm"
                  />
                </div>
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Company</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={createUserForm.company}
                    onChange={(e) =>
                      setCreateUserForm({ ...createUserForm, company: e.target.value })
                    }
                    placeholder="Acme Inc."
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm"
                  />
                </div>
              </div>

              {/* Website */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Website</label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="url"
                    value={createUserForm.website}
                    onChange={(e) =>
                      setCreateUserForm({ ...createUserForm, website: e.target.value })
                    }
                    placeholder="https://example.com"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">User Role</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCreateUserForm({ ...createUserForm, role: 'user' })}
                    className={`flex items-center justify-center gap-2 p-4 rounded-xl border transition-all ${
                      createUserForm.role === 'user'
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                        : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    <span className="font-medium">User</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateUserForm({ ...createUserForm, role: 'admin' })}
                    className={`flex items-center justify-center gap-2 p-4 rounded-xl border transition-all ${
                      createUserForm.role === 'admin'
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
                        : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <Shield className="w-5 h-5" />
                    <span className="font-medium">Admin</span>
                  </button>
                </div>
                {createUserForm.role === 'admin' && (
                  <p className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Admin users have full access to the admin panel
                  </p>
                )}
              </div>

              {/* Info Note */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  Admin-created users are automatically verified and can log in immediately
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={creatingUser}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingUser ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Creating User...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Create {createUserForm.role === 'admin' ? 'Admin' : 'User'}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Ban User Modal */}
      <BanUserModal
        isOpen={!!banModalUser}
        onClose={() => setBanModalUser(null)}
        onConfirm={handleBanUser}
        user={banModalUser}
      />

      {/* Unban User Modal */}
      <UnbanUserModal
        isOpen={!!unbanModalUser}
        onClose={() => setUnbanModalUser(null)}
        onConfirm={handleUnbanUser}
        user={unbanModalUser}
      />
    </div>
  );
};

export default AdminDashboard;
