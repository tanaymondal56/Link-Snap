import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, History, MessageSquare, ShieldAlert, CheckCircle, Clock, User, Phone, Building2, Globe, ArrowRight, AlertCircle, Shield, Ban } from 'lucide-react';
import api from '../../api/axios';
import { formatDateTime } from '../../utils/dateUtils';
import { useDialog } from '../ui/DialogProvider';
import showToast from '../../utils/toastUtils';
import IdBadge from '../ui/IdBadge';
import useScrollLock from '../../hooks/useScrollLock';

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

  // Lock background scroll
  useScrollLock(isOpen);

  if (!isOpen || !user) return null;


  return createPortal(
    <div 
      data-modal-content
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div data-modal-content className="relative w-full max-w-2xl bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] overscroll-contain animate-scale-in">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-blue-500/20">
              {user.firstName ? user.firstName[0].toUpperCase() : user.email[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {user.username ? (
                  <>
                    @{user.username}
                    <IdBadge id={user._id} />
                  </>
                ) : (
                  user.email
                )}
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>{user.email}</span>
                <span className="w-1 h-1 bg-gray-600 rounded-full" />
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                  user.role === 'admin' 
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }`}>
                  {user.role}
                </span>
                {user.isBanned && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                    <ShieldAlert size={10} /> Banned
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-black/20 px-6 gap-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <User size={16} /> Profile
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <History size={16} /> Ban History
          </button>
          <button
            onClick={() => setActiveTab('appeals')}
            className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 relative ${
              activeTab === 'appeals'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <MessageSquare size={16} /> Appeals
            {appeals.length > 0 && (
              <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {appeals.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('usernames')}
            className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'usernames'
                ? 'border-green-500 text-green-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Clock size={16} /> Username History
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : (
            <>
              {/* PROFILE TAB */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</label>
                      <div className="flex items-center gap-2 text-white bg-white/5 p-3 rounded-xl border border-white/5">
                        <User size={16} className="text-gray-400" />
                        {user.firstName} {user.lastName}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</label>
                      <div className="flex items-center gap-2 text-white bg-white/5 p-3 rounded-xl border border-white/5">
                        <Clock size={16} className="text-gray-400" />
                        {formatDateTime(user.createdAt)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</label>
                      <div className="flex items-center gap-2 text-white bg-white/5 p-3 rounded-xl border border-white/5">
                        <Phone size={16} className="text-gray-400" />
                        {user.phone || 'Not provided'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Company</label>
                      <div className="flex items-center gap-2 text-white bg-white/5 p-3 rounded-xl border border-white/5">
                        <Building2 size={16} className="text-gray-400" />
                        {user.company || 'Not provided'}
                      </div>
                    </div>
                  </div>

                  {/* Account Status Card */}
                  <div className="p-4 bg-gray-800/50 rounded-xl border border-white/5">
                     <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                       <Shield size={18} className="text-blue-400" /> Account Status
                     </h4>
                     <div className="grid grid-cols-2 gap-4">
                       <div className="bg-black/20 p-3 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">Email Verification</p>
                          <p className={`font-medium ${user.isVerified ? 'text-green-400' : 'text-yellow-400'} flex items-center gap-1.5`}>
                            {user.isVerified ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                            {user.isVerified ? 'Verified' : 'Pending'}
                          </p>
                       </div>
                       <div className="bg-black/20 p-3 rounded-lg">
                          <p className="text-xs text-gray-400 mb-1">Ban Status</p>
                          <p className={`font-medium ${user.isBanned ? 'text-red-400' : 'text-green-400'} flex items-center gap-1.5`}>
                             {user.isBanned ? <Ban size={14} /> : <CheckCircle size={14} />}
                             {user.isBanned ? 'Banned' : 'Active'}
                          </p>
                       </div>
                     </div>
                  </div>
                </div>
              )}

              {/* BAN HISTORY TAB */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  {banHistory.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-white/5 rounded-xl border border-dashed border-gray-700">
                      <ShieldCircle size={48} className="mx-auto mb-3 opacity-20" />
                      <p>No ban history found</p>
                    </div>
                  ) : (
                    banHistory.map((event) => (
                      <div key={event._id} className="bg-gray-800/50 rounded-xl p-4 border border-white/5 relative overflow-hidden group">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${event.type === 'ban' ? 'bg-red-500' : 'bg-green-500'}`} />
                        <div className="flex justify-between items-start">
                          <div>
                            <p className={`font-bold text-sm ${event.type === 'ban' ? 'text-red-400' : 'text-green-400'} flex items-center gap-2 mb-1`}>
                              {event.type === 'ban' ? <Ban size={14} /> : <CheckCircle size={14} />}
                              {event.type.toUpperCase()}
                            </p>
                            <p className="text-gray-300 text-sm">{event.reason || 'No reason provided'}</p>
                            {event.expiresAt && (
                               <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
                                 <Clock size={12} /> Expires: {formatDateTime(event.expiresAt)}
                               </p>
                            )}
                          </div>
                          <div className="text-right">
                             <p className="text-xs text-gray-500">{formatDateTime(event.createdAt)}</p>
                             <p className="text-xs text-gray-600 mt-0.5">by {event.adminId?.email || 'System'}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* APPEALS TAB */}
              {activeTab === 'appeals' && (
                <div className="space-y-4">
                  {appeals.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-white/5 rounded-xl border border-dashed border-gray-700">
                      <MessageSquare size={48} className="mx-auto mb-3 opacity-20" />
                      <p>No appeals found</p>
                    </div>
                  ) : (
                    appeals.map((appeal) => (
                      <div key={appeal._id} className="bg-gray-800/50 rounded-xl p-4 border border-white/5">
                        <div className="flex justify-between items-start mb-3">
                           <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                             appeal.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                             appeal.status === 'approved' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                             'bg-red-500/10 text-red-400 border border-red-500/20'
                           }`}>
                             {appeal.status}
                           </span>
                           <span className="text-xs text-gray-500">{formatDateTime(appeal.createdAt)}</span>
                        </div>
                        
                        <div className="bg-black/30 p-3 rounded-lg mb-3">
                           <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Appeal Message</p>
                           <p className="text-sm text-gray-300 italic">"{appeal.reason}"</p>
                        </div>

                        {appeal.adminResponse && (
                           <div className="bg-blue-500/5 border border-blue-500/10 p-3 rounded-lg mb-3">
                              <p className="text-xs text-blue-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                                <Shield size={10} /> Admin Response
                              </p>
                              <p className="text-sm text-gray-300">{appeal.adminResponse}</p>
                           </div>
                        )}

                        {appeal.status === 'pending' && (
                          <div className="flex gap-2 mt-4 pt-3 border-t border-white/5">
                            <button
                              onClick={() => handleRespondToAppeal(appeal._id, 'approved', true)}
                              className="flex-1 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-bold rounded-lg border border-green-500/20 transition-all flex items-center justify-center gap-1.5"
                            >
                              <CheckCircle size={14} /> Approve & Unban
                            </button>
                            <button
                              onClick={() => handleRespondToAppeal(appeal._id, 'rejected')}
                              className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg border border-red-500/20 transition-all flex items-center justify-center gap-1.5"
                            >
                              <X size={14} /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* USERNAME HISTORY TAB */}
              {activeTab === 'usernames' && (
                 <div className="space-y-6">
                    <div className="bg-violet-500/10 border border-violet-500/20 p-4 rounded-xl flex items-center gap-4">
                       <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400">
                          <Globe size={20} />
                       </div>
                       <div>
                          <p className="text-xs text-violet-300 uppercase tracking-wider">Current Username</p>
                          <p className="text-lg font-bold text-white">@{usernameHistory.currentUsername || 'None'}</p>
                          {usernameHistory.usernameChangedAt && (
                             <p className="text-xs text-gray-500 mt-0.5">Last changed: {formatDateTime(usernameHistory.usernameChangedAt)}</p>
                          )}
                       </div>
                    </div>

                    <div>
                       <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                          <History size={16} className="text-gray-400" /> Previous Usernames
                       </h4>
                       <div className="space-y-3">
                          {usernameHistory.history?.length === 0 ? (
                             <p className="text-sm text-gray-500 italic">No previous usernames recorded.</p>
                          ) : (
                             usernameHistory.history.map((record, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-white/5">
                                   <div className="flex items-center gap-3">
                                      <span className="text-gray-500 font-mono text-xs">#{usernameHistory.history.length - i}</span>
                                      <span className="text-gray-300 line-through">@{record.username}</span>
                                      <ArrowRight size={14} className="text-gray-600" />
                                   </div>
                                   <span className="text-xs text-gray-500">{formatDateTime(record.changedAt)}</span>
                                </div>
                             ))
                          )}
                       </div>
                    </div>
                 </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default UserDetailsModal;
