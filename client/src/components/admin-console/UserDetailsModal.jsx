import { useState, useEffect } from 'react';
import { X, History, MessageSquare, ShieldAlert, CheckCircle, Clock, User, Phone, Building2, Globe, ArrowRight } from 'lucide-react';
import api from '../../api/axios';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { useDialog } from '../ui/DialogProvider';
import showToast from '../../utils/toastUtils';
import IdBadge from '../ui/IdBadge';

const UserDetailsModal = ({ isOpen, onClose, user }) => {
  const { prompt } = useDialog();
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'history' | 'appeals' | 'usernames'
  const [banHistory, setBanHistory] = useState([]);
  const [usernameHistory, setUsernameHistory] = useState({ history: [], currentUsername: '', usernameChangedAt: null });
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(false);

  // Function to refresh data
  const refreshData = async () => {
    setLoading(true);
    try {
      const [historyRes, appealsRes, usernamesRes] = await Promise.all([
        api.get(`/admin/users/${user._id}/ban-history`),
        api.get(`/admin/users/${user._id}/appeals`),
        api.get(`/admin/users/${user._id}/username-history`)
      ]);
      setBanHistory(historyRes.data);
      setAppeals(appealsRes.data);
      setUsernameHistory(usernamesRes.data);
    } catch (error) {
      console.error('Failed to fetch details', error);
      showToast.error('Failed to refresh data');
    } finally {
      setLoading(false);
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
        `Appeal ${status}${status === 'approved' && unbanUser ? ' and user unbanned' : ''}`
      );
      
      refreshData();
    } catch (error) {
      console.error('Failed to respond to appeal:', error);
      showToast.error(error.response?.data?.message || 'Failed to update appeal');
    }
  };

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen && user) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const [historyRes, appealsRes, usernamesRes] = await Promise.all([
            api.get(`/admin/users/${user._id}/ban-history`),
            api.get(`/admin/users/${user._id}/appeals`),
            api.get(`/admin/users/${user._id}/username-history`)
          ]);
          setBanHistory(historyRes.data);
          setAppeals(appealsRes.data);
          setUsernameHistory(usernamesRes.data);
        } catch (error) {
          console.error('Failed to fetch details', error);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen, user]);

  // Escape key to close modal
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] overscroll-contain">
        
        {/* Header */}
        <div className="shrink-0 p-4 md:p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div>
            <h2 className="text-xl font-bold text-white">{user.firstName} {user.lastName}</h2>
            {user.username && <p className="text-sm text-purple-400">@{user.username}</p>}
            <p className="text-sm text-gray-400">{user.email}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-white/5 px-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-4 mr-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'profile' ? 'border-green-500 text-green-400' : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <User size={16} /> Profile
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 mr-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'history' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <History size={16} /> Ban History
          </button>
          <button
            onClick={() => setActiveTab('appeals')}
            className={`py-4 mr-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'appeals' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <MessageSquare size={16} /> Appeals
          </button>
          <button
            onClick={() => setActiveTab('usernames')}
            className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'usernames' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <User size={16} /> Username History
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-900/50">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {activeTab === 'profile' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Phone */}
                    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-4 border border-white/5">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Phone size={18} className="text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="text-sm text-white">
                          {user.phone || <span className="text-gray-600">Not provided</span>}
                        </p>
                      </div>
                    </div>

                    {/* Company */}
                    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-4 border border-white/5">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Building2 size={18} className="text-purple-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Company</p>
                        <p className="text-sm text-white">
                          {user.company || <span className="text-gray-600">Not provided</span>}
                        </p>
                      </div>
                    </div>

                    {/* Website */}
                    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-4 border border-white/5">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <Globe size={18} className="text-green-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Website</p>
                        {user.website ? (
                          <a
                            href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-green-400 hover:underline truncate block max-w-[180px]"
                          >
                            {user.website.replace(/^https?:\/\//, '')}
                          </a>
                        ) : (
                          <p className="text-sm text-gray-600">Not provided</p>
                        )}
                      </div>
                    </div>

                    {/* Last Login */}
                    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-4 border border-white/5">
                      <div className="p-2 bg-orange-500/20 rounded-lg">
                        <Clock size={18} className="text-orange-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Last Login</p>
                        <p className="text-sm text-white">
                          {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : <span className="text-gray-600">Never</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/5">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Account Details</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Username:</span>
                        <span className="ml-2 text-purple-400">
                          {user.username ? `@${user.username}` : <span className="text-gray-600">Not set</span>}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Role:</span>
                        <span className={`ml-2 ${user.role === 'admin' ? 'text-purple-400' : 'text-blue-400'}`}>
                          {user.role}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Verified:</span>
                        <span className={`ml-2 ${user.isVerified ? 'text-green-400' : 'text-yellow-400'}`}>
                          {user.isVerified ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Joined:</span>
                        <span className="ml-2 text-white">{formatDate(user.createdAt)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <span className={`ml-2 ${(user.banned || user.isActive === false) ? 'text-red-400' : 'text-green-400'}`}>
                          {(user.banned || user.isActive === false) ? 'Banned' : 'Active'}
                        </span>
                      </div>
                      {user.snapId && (
                        <div>
                          <span className="text-gray-500">Snap ID:</span>
                          <code className="ml-2 text-gray-300 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-xs font-mono">
                            {user.snapId}
                          </code>
                        </div>
                      )}
                      {(user.eliteId) && user.idTier && (
                        <div className="col-span-2 mt-2 pt-2 border-t border-white/10 flex items-center">
                          <span className="text-gray-500 mr-2">Elite Badge:</span>
                          <IdBadge eliteId={user.eliteId} idTier={user.idTier} size="sm" />
                        </div>
                      )}
                      
                      {/* Subscription Section */}
                      <div className="col-span-2 mt-4 pt-4 border-t border-white/10">
                        <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          Subscription
                        </h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500">Tier:</span>
                            <span className={`ml-2 font-semibold capitalize ${
                              user.subscription?.tier === 'pro' ? 'text-purple-400' : 
                              user.subscription?.tier === 'business' ? 'text-amber-400' : 
                              'text-gray-400'
                            }`}>
                              {user.subscription?.tier || 'Free'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Status:</span>
                            <span className={`ml-2 ${
                              user.subscription?.status === 'active' ? 'text-green-400' : 
                              user.subscription?.status === 'past_due' ? 'text-red-400' : 
                              user.subscription?.status === 'cancelled' ? 'text-yellow-400' : 
                              'text-gray-400'
                            }`}>
                              {user.subscription?.status || 'active'}
                            </span>
                          </div>
                          {user.subscription?.currentPeriodEnd && (
                            <div className="col-span-2">
                              <span className="text-gray-500">Renews:</span>
                              <span className="ml-2 text-white">{formatDate(user.subscription.currentPeriodEnd)}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-500">Links Used:</span>
                            <span className="ml-2 text-white">{user.linkUsage?.count || 0}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Clicks Used:</span>
                            <span className="ml-2 text-white">{user.clickUsage?.count || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4">
                  {banHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No ban history found.</div>
                  ) : (
                    banHistory.map((record, i) => (
                      <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                            record.action === 'ban' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
                          }`}>
                            {(record.action || 'unknown').toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock size={12} /> {formatDateTime(record.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 mt-2">
                          <span className="text-gray-500">Reason:</span> {record.reason || 'No reason provided'}
                        </p>
                        {record.performedBy && (
                           <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-white/5">
                             Action by: {record.performedBy.firstName} ({record.performedBy.email})
                           </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'appeals' && (
                <div className="space-y-4">
                  {appeals.length === 0 ? (
                     <div className="text-center py-8 text-gray-500">No appeals found.</div>
                  ) : (
                    appeals.map((appeal) => (
                      <div key={appeal._id} className="bg-white/5 rounded-xl p-4 border border-white/5 relative">
                        <div className="absolute top-4 right-4">
                          {appeal.status === 'pending' && <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-1 rounded">Pending</span>}
                          {appeal.status === 'approved' && <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded">Approved</span>}
                          {appeal.status === 'rejected' && <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded">Rejected</span>}
                        </div>
                        <h4 className="text-sm font-medium text-white mb-2">My Appeal</h4>
                        <p className="text-sm text-gray-300 bg-black/20 p-3 rounded-lg mb-4">
                          "{appeal.message}"
                        </p>
                        
                        {/* Action Buttons for Pending Appeals */}
                        {appeal.status === 'pending' && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            <button
                              onClick={() => handleRespondToAppeal(appeal._id, 'approved', true)}
                              className="flex-1 min-w-[120px] px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg text-sm font-medium transition-colors"
                            >
                              Approve & Unban
                            </button>
                            <button
                              onClick={() => handleRespondToAppeal(appeal._id, 'approved', false)}
                              className="px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-sm font-medium transition-colors"
                            >
                              Approve Only
                            </button>
                            <button
                              onClick={() => handleRespondToAppeal(appeal._id, 'rejected')}
                              className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm font-medium transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}

                        {appeal.adminResponse && (
                          <div className="mt-4 pl-4 border-l-2 border-blue-500/50">
                            <h5 className="text-xs font-bold text-blue-400 mb-1">Admin Response</h5>
                            <p className="text-sm text-gray-400">{appeal.adminResponse}</p>
                          </div>
                        )}
                        <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                          <span>Created: {formatDate(appeal.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'usernames' && (
                <div className="space-y-4">
                  {usernameHistory.history?.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No username changes yet.</div>
                  ) : (
                    <>
                      <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                        <p className="text-sm text-cyan-400">
                          Current: <span className="font-medium">@{usernameHistory.currentUsername}</span>
                          {usernameHistory.usernameChangedAt && (
                            <span className="ml-2 text-gray-500 text-xs">
                              (Last changed: {formatDate(usernameHistory.usernameChangedAt)})
                            </span>
                          )}
                        </p>
                      </div>
                      {usernameHistory.history?.map((record, i) => (
                        <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-400">@{record.previousUsername}</span>
                            <ArrowRight size={16} className="text-cyan-400" />
                            <span className="text-sm text-white font-medium">@{record.newUsername}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock size={12} /> {formatDateTime(record.changedAt)}
                            </span>
                            <span>
                              {record.changedBy ? (
                                `Changed by: ${record.changedBy.firstName || record.changedBy.email}`
                              ) : (
                                'Self-initiated'
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDetailsModal;
