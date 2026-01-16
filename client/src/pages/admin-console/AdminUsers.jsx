import { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  UserPlus, 
  Shield, 
  ShieldAlert, 
  Trash2, 
  UserCheck, 
  UserX,
  Mail,
  MoreHorizontal,
  Timer,
  RefreshCw,
  AlertCircle,
  Users,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Crown,
  Zap
} from 'lucide-react';
import GlassTable from '../../components/admin-console/ui/GlassTable';
import api from '../../api/axios';
import { formatDate } from '../../utils/dateUtils';
import BanUserModal from '../../components/BanUserModal';
import UnbanUserModal from '../../components/UnbanUserModal';
import { useConfirm } from '../../context/ConfirmContext';
import showToast from '../../utils/toastUtils';

import CreateUserModal from '../../components/admin-console/CreateUserModal';
import ManageSubscriptionModal from '../../components/admin-console/ManageSubscriptionModal';
import UserDetailsModal from '../../components/admin-console/UserDetailsModal';

import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import IdBadge from '../../components/ui/IdBadge';

import { useAuth } from '../../context/AuthContext';

const AdminUsers = () => {
  const { isAuthChecking } = useAuth();
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all'); // all, admin, user
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Modals
  const [banModalUser, setBanModalUser] = useState(null);
  const [unbanModalUser, setUnbanModalUser] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailsUser, setDetailsUser] = useState(null);
  const [manageSubUser, setManageSubUser] = useState(null);
  
  // User Dropdown State
  const [openActionId, setOpenActionId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
        setDebouncedSearch(searchTerm);
        setPage(1); // Reset to page 1 on search
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users', {
          params: {
              page,
              limit: 20,
              search: debouncedSearch,
              role: filterRole
          }
      });
      // Handle both paginated and legacy array response structures gracefully
      if (Array.isArray(data)) {
          setUsers(data);
          setTotalUsers(data.length);
          setTotalPages(1);
      } else {
          setUsers(data.users);
          setTotalPages(data.pages);
          setTotalUsers(data.total);
      }
    } catch {
      showToast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterRole]);

  useEffect(() => {
    // Wait for auth check to complete (ensure token is ready)
    if (!isAuthChecking) {
      fetchUsers();
    }
  }, [fetchUsers, isAuthChecking]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchUsers();
      showToast.success('Data refreshed');
    } catch {
      showToast.error('Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

  const isRefreshing = usePullToRefresh(async () => {
     await handleRefresh();
  });

  const handleToggleUserStatus = (user) => {
    // Check both banned and isActive for backwards compatibility
    const isBanned = user.banned || user.isActive === false;
    if (isBanned) {
      setUnbanModalUser(user);
    } else {
      setBanModalUser(user);
    }
    setOpenActionId(null);
  };

  // Helper function to check if user is banned (handles both field types)
  const isUserBanned = (user) => user.banned || user.isActive === false;

  // Compute stats - use totalUsers for accurate count, current page for admins/banned
  const stats = {
    total: totalUsers, // Use the accurate total from API
    admins: users.filter(u => u.role === 'admin').length,
    banned: users.filter(u => isUserBanned(u)).length,
  };

  const handleBanUser = async ({ reason, disableLinks, duration }) => {
    if (!banModalUser) return;
    try {
      const { data } = await api.patch(`/admin/users/${banModalUser._id}/status`, {
        reason,
        disableLinks,
        duration,
      });
      // Update local state
      setUsers(users.map(u => u._id === banModalUser._id ? { ...u, ...data.user } : u));
      setBanModalUser(null);
      showToast.success('User banned successfully');
    } catch {
      showToast.error('Failed to ban user');
    }
  };

  const handleUnbanUser = async ({ reenableLinks }) => {
    if (!unbanModalUser) return;
    try {
      const { data } = await api.patch(`/admin/users/${unbanModalUser._id}/status`, { reenableLinks });
      setUsers(users.map(u => u._id === unbanModalUser._id ? { ...u, ...data.user } : u));
      setUnbanModalUser(null);
      showToast.success('User activated successfully');
    } catch {
      showToast.error('Failed to unban user');
    }
  };

  const handleDeleteUser = async (userId) => {
    setOpenActionId(null);
    const confirmed = await confirm({
      title: 'Delete User Permanently?',
      message: 'This will wipe all data including links and analytics. Irreversible.',
      confirmText: 'Delete Forever',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await api.delete(`/admin/users/${userId}`);
      
      // If this was the last item on the page and not the first page, go back
      if (users.length === 1 && page > 1) {
          setPage(prev => prev - 1);
      } else {
          // Otherwise just remove from local state
          setUsers(users.filter(u => u._id !== userId));
      }
      
      setTotalUsers(prev => prev - 1);
      showToast.success('User deleted');
    } catch {
      showToast.error('Failed to delete user');
    }
  };

  const handleToggleRole = async (user) => {
    setOpenActionId(null);
    const isPromoting = user.role !== 'admin';
    const confirmed = await confirm({
      title: isPromoting ? 'Promote to Admin?' : 'Demote to User?',
      message: isPromoting ? 'Grant full system access?' : 'Revoke admin access?',
      confirmText: isPromoting ? 'Promote' : 'Demote',
      variant: isPromoting ? 'promote' : 'demote',
    });
    if (!confirmed) return;

    try {
      const { data } = await api.patch(`/admin/users/${user._id}/role`);
      setUsers(users.map(u => u._id === user._id ? { ...u, role: data.user.role } : u));
      showToast.success(`User ${isPromoting ? 'promoted' : 'demoted'}`);
    } catch {
      showToast.error('Failed to update role');
    }
  };

  // Callback to update user after subscription change
  const handleUserUpdate = (updatedUser) => {
    setUsers(users.map(u => u._id === updatedUser._id ? { ...u, ...updatedUser } : u));
  };

  // Note: Client-side filtering removed - now handled server-side via API params

  return (
    <div className="space-y-6">
      {/* Pull to Refresh Indicator */}
      {isRefreshing && (
        <div className="flex justify-center py-2 animate-fade-in">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      )}

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Users
          </h1>
          <p className="text-gray-400 mt-1">Manage accounts and permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 font-medium"
          >
            <UserPlus size={18} />
            Add User
          </button>
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-all border border-white/10 disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Users size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Users</p>
            <p className="text-lg font-bold text-white">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Shield size={18} className="text-purple-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Admins</p>
            <p className="text-lg font-bold text-white">{stats.admins}</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <ShieldAlert size={18} className="text-red-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Banned</p>
            <p className="text-lg font-bold text-white">{stats.banned}</p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 p-1 rounded-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="Search users..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900/40 backdrop-blur-md border border-white/5 rounded-xl text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-gray-600"
          />
        </div>
        <div className="flex gap-2">
           {['all', 'admin', 'user'].map(role => (
             <button
               key={role}
               onClick={() => { setFilterRole(role); setPage(1); }}
               className={`px-4 py-2 rounded-xl text-sm capitalize transition-all border ${
                 filterRole === role 
                 ? 'bg-white/10 text-white border-white/20' 
                 : 'bg-transparent text-gray-500 border-transparent hover:bg-white/5'
               }`}
             >
               {role}
             </button>
           ))}
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No users found</div>
        ) : (
          users.map((user) => (
            <div key={user._id} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-sm font-bold text-white shadow-lg">
                    {user.firstName ? user.firstName[0] : user.email[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-white">{user.firstName} {user.lastName}</div>
                    {user.username && <div className="text-xs text-purple-400">@{user.username}</div>}
                    <div className="text-xs text-gray-400">{user.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => setOpenActionId(openActionId === user._id ? null : user._id)}
                  className="p-2 hover:bg-white/10 rounded-lg text-gray-400"
                >
                  <MoreVertical size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-white/5 rounded-lg p-2">
                  <span className="text-xs text-gray-500 block">Role</span>
                  <span className={`text-xs font-medium uppercase ${
                    user.role === 'admin' ? 'text-purple-400' : 'text-blue-400'
                  }`}>
                    {user.role}
                  </span>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <span className="text-xs text-gray-500 block">Status</span>
                  <span className={`text-xs font-medium ${
                    isUserBanned(user) ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {isUserBanned(user) ? 'Banned' : 'Active'}
                  </span>
                </div>
              </div>

              {/* Mobile Actions Dropdown */}
              {openActionId === user._id && (
                <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden animate-fade-in text-sm">
                  <button
                    onClick={() => {
                       setDetailsUser(user);
                       setOpenActionId(null);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/5 text-gray-300 hover:text-white"
                  >
                    <Users size={16} /> View Details
                  </button>
                  <button 
                    onClick={() => {
                      setManageSubUser(user);
                      setOpenActionId(null);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/5 text-blue-400"
                  >
                   {user.subscription?.tier === 'pro' || user.subscription?.tier === 'business' ? (
                       <><Crown size={16} /> Manage Subscription</>
                   ) : (
                       <><Crown size={16} /> Gift Premium</>
                   )}
                  </button>
                  <button 
                    onClick={() => handleToggleUserStatus(user)}
                    className={`w-full flex items-center gap-2 px-4 py-3 hover:bg-white/5 ${
                      isUserBanned(user) ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {isUserBanned(user) ? <UserCheck size={16} /> : <UserX size={16} />}
                    {isUserBanned(user) ? 'Unban User' : 'Ban User'}
                  </button>
                  <button
                    onClick={() => handleToggleRole(user)}
                    className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/5 text-blue-400"
                  >
                    <Shield size={16} />
                    {user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user._id)}
                    className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/5 text-red-400"
                  >
                    <Trash2 size={16} /> Delete User
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <GlassTable headers={['User', 'ID', 'Username', 'Name', 'Role', 'Status', 'Joined', 'Actions']}>
        {loading ? (
          <tr>
            <td colSpan="8" className="p-8 text-center text-gray-500">Loading users...</td>
          </tr>
        ) : users.length === 0 ? (
          <tr>
            <td colSpan="8" className="p-8 text-center text-gray-500">No users found</td>
          </tr>
        ) : (
          users.map((user) => (
            <tr key={user._id} className="hover:bg-white/5 transition-colors group">
              <td className="p-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-sm font-bold text-white shadow-lg">
                    {user.firstName ? user.firstName[0] : user.email[0].toUpperCase()}
                  </div>
                  <div className="font-medium text-white flex items-center gap-2">
                    {user.email}
                    {user.subscription?.tier === 'pro' && (
                      <span className="p-0.5 rounded bg-purple-500/10 border border-purple-500/20" title="Pro Plan">
                        <Crown size={12} className="text-purple-400" />
                      </span>
                    )}
                    {user.subscription?.tier === 'business' && (
                      <span className="p-0.5 rounded bg-amber-500/10 border border-amber-500/20" title="Business Plan">
                        <Zap size={12} className="text-amber-400" />
                      </span>
                    )}
                  </div>
                </div>
              </td>
                <td className="p-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1.5 items-start">
                    {(user.eliteId) && user.idTier ? (
                      <IdBadge 
                        eliteId={user.eliteId} 
                        idTier={user.idTier} 
                        size="sm" 
                        showTooltip={false} 
                      />
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                    {user.snapId && (
                      <code className="text-[10px] text-gray-500 font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                        {user.snapId}
                      </code>
                    )}
                  </div>
                </td>
              <td className="p-4 whitespace-nowrap">
                {user.username ? (
                  <span className="text-purple-400">@{user.username}</span>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </td>
              <td className="p-4 whitespace-nowrap">
                {user.firstName || user.lastName ? (
                  <span className="text-white">{user.firstName} {user.lastName}</span>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </td>
              <td className="p-4">
                <span className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${
                  user.role === 'admin' 
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}>
                  {user.role}
                </span>
              </td>
              <td className="p-4">
                {isUserBanned(user) ? (
                  <div className="flex flex-col gap-1">
                    {user.bannedReason && user.bannedReason.includes('Unban Pending') ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                        <Timer size={12} /> Unban Pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        <ShieldAlert size={12} /> Banned
                      </span>
                    )}
                    {user.bannedUntil ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-orange-400" title={`Unbans: ${formatDate(user.bannedUntil)}`}>
                        <Timer size={10} /> {formatDate(user.bannedUntil)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-red-400">Permanent</span>
                    )}
                  </div>
                ) : !user.isVerified ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    <AlertCircle size={12} /> Unverified
                  </span>
                ) : user.subscription?.status === 'paused' ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    <Timer size={12} /> Paused
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                    <UserCheck size={12} /> Active
                  </span>
                )}
              </td>
              <td className="p-4 text-gray-500">
                {formatDate(user.createdAt)}
              </td>
              <td className="p-4">
                <div className="relative">
                  <button 
                    onClick={() => setOpenActionId(openActionId === user._id ? null : user._id)}
                    className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  
                  {/* Action Dropdown */}
                  {openActionId === user._id && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setOpenActionId(null)} 
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden animate-fade-in">
                        <button 
                          onClick={() => { setDetailsUser(user); setOpenActionId(null); }}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 flex items-center gap-2 text-gray-300 hover:text-white"
                        >
                          <MoreVertical size={16} /> View Details
                        </button>
                        <button 
                            onClick={() => {
                                setManageSubUser(user);
                                setOpenActionId(null);
                            }}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 flex items-center gap-2 text-blue-400 hover:text-blue-300"
                        >
                            {user.subscription?.tier === 'pro' || user.subscription?.tier === 'business' ? (
                                <><Crown size={16} /> Manage Subscription</>
                            ) : (
                                <><Crown size={16} /> Gift Premium</>
                            )}
                        </button>
                        <button 
                          onClick={() => handleToggleRole(user)}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 flex items-center gap-2 text-gray-300 hover:text-white"
                        >
                          <Shield size={16} /> {user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                        </button>
                        <button 
                          onClick={() => handleToggleUserStatus(user)}
                          className={`w-full text-left px-4 py-3 text-sm hover:bg-white/5 flex items-center gap-2 ${isUserBanned(user) ? 'text-green-400' : 'text-orange-400'}`}
                        >
                          {isUserBanned(user) ? <UserCheck size={16} /> : <UserX size={16} />} 
                          {isUserBanned(user) ? 'Unban User' : 'Ban User'}
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user._id)}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-red-500/10 text-red-400 flex items-center gap-2 border-t border-white/5"
                        >
                          <Trash2 size={16} /> Delete User
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))
        )}
      </GlassTable>
      </div>

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <div className="text-sm text-gray-400">
            Showing <span className="text-white font-medium">{users.length}</span> of <span className="text-white font-medium">{totalUsers}</span> users
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-gray-400 hover:text-white transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <BanUserModal 
        isOpen={!!banModalUser}
        onClose={() => setBanModalUser(null)}
        onConfirm={handleBanUser}
        user={banModalUser}
      />
      <UnbanUserModal 
        isOpen={!!unbanModalUser}
        onClose={() => setUnbanModalUser(null)}
        onConfirm={handleUnbanUser}
        user={unbanModalUser}
      />
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onUserCreated={fetchUsers}
      />
      <UserDetailsModal
        isOpen={!!detailsUser}
        onClose={() => setDetailsUser(null)}
        user={detailsUser}
      />
      <ManageSubscriptionModal 
        isOpen={!!manageSubUser}
        onClose={() => setManageSubUser(null)}
        user={manageSubUser}
        onUpdate={handleUserUpdate}
      />
    </div>
  );
};

export default AdminUsers;
