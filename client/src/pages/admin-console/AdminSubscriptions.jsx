import { useState, useEffect, useCallback } from 'react';
import { 
  CreditCard, 
  Users, 
  TrendingUp, 
  Gift, 
  Plus, 
  Copy, 
  Trash2,
  RefreshCw,
  Crown,
  Zap,
  ChevronLeft,
  ChevronRight,
  Search,
  MoreVertical,
  Shield,
  Timer
} from 'lucide-react';
import api from '../../api/axios';
import showToast from '../../components/ui/Toast';
import { formatDate } from '../../utils/dateUtils';
import { useDialog } from '../../components/ui/DialogProvider';
import GlassTable from '../../components/admin-console/ui/GlassTable';
import IdBadge from '../../components/ui/IdBadge';
import GenerateCodeModal from '../../components/admin-console/GenerateCodeModal';

const AdminSubscriptions = () => {
  const { confirm } = useDialog();
  const [stats, setStats] = useState(null);
  const [codes, setCodes] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [codesLoading, setCodesLoading] = useState(false);
  const [subsLoading, setSubsLoading] = useState(false);
  
  const [activeTab, setActiveTab] = useState('overview'); // overview | subscribers | codes
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  
  // Stats for Overview
  const fetchStats = async () => {
    try {
      const { data } = await api.get('/admin/subscriptions/stats');
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
      showToast.error('Failed to load subscription stats');
    }
  };

  // Pagination for Codes
  const [codesPage, setCodesPage] = useState(1);
  // Unused pagination state removed to fix lint errors
  // const [codesTotalPages, setCodesTotalPages] = useState(1);
  // const [totalCodes, setTotalCodes] = useState(0);

  const fetchCodes = async (page = 1) => {
    setCodesLoading(true);
    try {
      const { data } = await api.get(`/admin/redeem-codes?page=${page}&limit=20`);
      setCodes(data.codes);
      setCodesPage(data.page);
      // setCodesTotalPages(data.pages);
      // setTotalCodes(data.total);
    } catch {
      showToast.error('Failed to load redeem codes');
    } finally {
      setCodesLoading(false);
    }
  };

  // Pagination for Subscribers
  const [subsPage, setSubsPage] = useState(1);
  const [subsTotalPages, setSubsTotalPages] = useState(1);
  // const [totalSubs, setTotalSubs] = useState(0);

  const fetchSubscribers = useCallback(async (page = 1) => {
    setSubsLoading(true);
    try {
      // Use the new tier=paid filter
      const { data } = await api.get(`/admin/users`, {
        params: {
          page,
          limit: 20,
          tier: 'paid'
        }
      });
      // Handle response structure (AdminUsers logic)
      if (Array.isArray(data)) {
         setSubscribers(data);
         // setTotalSubs(data.length);
      } else {
         setSubscribers(data.users);
         setSubsPage(data.page);
         setSubsTotalPages(data.pages);
         // setTotalSubs(data.total);
      }
    } catch {
      showToast.error('Failed to load subscribers');
    } finally {
      setSubsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchCodes(1), fetchSubscribers(1)]);
      setLoading(false);
    };
    init();
  }, [fetchSubscribers]);

  // Actions
  const handleGenerateCode = () => setShowGenerateModal(true);
  
  const handleCopyCode = async (code) => {
    await navigator.clipboard.writeText(code);
    showToast.success('Code copied!');
  };

  const handleDeactivateCode = async (codeId, codeString) => {
    const confirmed = await confirm({
      title: 'Deactivate Code',
      message: `Deactivate code "${codeString}"?`,
      confirmText: 'Deactivate',
      variant: 'error' // Ensure variant matches what Dialog expects
    });
    if (!confirmed) return;
    try {
      await api.delete(`/admin/redeem-codes/${codeId}`);
      showToast.success('Code deactivated');
      fetchCodes(codesPage);
    } catch {
      showToast.error('Failed to deactivate');
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Subscriptions
          </h1>
          <p className="text-gray-400 mt-1">Monetization overview & Subscriber management</p>
        </div>
        <div className="flex gap-2">
            <button
                onClick={handleGenerateCode}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-xl shadow-lg shadow-green-900/20 font-medium transition-all"
            >
                <Plus size={18} /> Generate Code
            </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-1 overflow-x-auto">
        {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'subscribers', label: 'Subscribers', icon: Crown },
            { id: 'codes', label: 'Redeem Codes', icon: Gift }
        ].map(tab => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-t-lg font-medium transition-all relative ${
                    activeTab === tab.id
                    ? 'text-blue-400 bg-white/5 border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
                <tab.icon size={16} className={activeTab === tab.id ? 'text-blue-400' : 'text-gray-500'} />
                {tab.label}
            </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-8">
           {/* Stats Cards */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="glass-dark rounded-2xl p-6 border border-white/10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-blue-500/20"></div>
                  <div className="relative">
                      <p className="text-gray-400 text-sm font-medium mb-1">Total Paid Users</p>
                      <h3 className="text-3xl font-bold text-white">{stats.totalSubscribers || 0}</h3>
                      <div className="flex items-center gap-2 mt-4 text-xs text-blue-300 bg-blue-500/10 w-fit px-2 py-1 rounded-full">
                          <Users size={12} /> Active
                      </div>
                  </div>
              </div>

              <div className="glass-dark rounded-2xl p-6 border border-purple-500/20 bg-purple-500/5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-purple-500/20"></div>
                  <div className="relative">
                      <p className="text-purple-300 text-sm font-medium mb-1">Pro Users</p>
                      <h3 className="text-3xl font-bold text-white">{stats.byTier.pro || 0}</h3>
                      <div className="flex items-center gap-2 mt-4 text-xs text-purple-300 bg-purple-500/10 w-fit px-2 py-1 rounded-full">
                          <Crown size={12} /> Pro Plan
                      </div>
                  </div>
              </div>

              <div className="glass-dark rounded-2xl p-6 border border-amber-500/20 bg-amber-500/5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-amber-500/20"></div>
                  <div className="relative">
                      <p className="text-amber-300 text-sm font-medium mb-1">Business Users</p>
                      <h3 className="text-3xl font-bold text-white">{stats.byTier.business || 0}</h3>
                      <div className="flex items-center gap-2 mt-4 text-xs text-amber-300 bg-amber-500/10 w-fit px-2 py-1 rounded-full">
                          <Zap size={12} /> Business
                      </div>
                  </div>
              </div>
              
              <div className="glass-dark rounded-2xl p-6 border border-green-500/20 bg-green-500/5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-green-500/20"></div>
                  <div className="relative">
                      <p className="text-green-300 text-sm font-medium mb-1">Free Users</p>
                      <h3 className="text-3xl font-bold text-white">{stats.byTier.free || 0}</h3>
                       <div className="flex items-center gap-2 mt-4 text-xs text-green-300 bg-green-500/10 w-fit px-2 py-1 rounded-full">
                          <Users size={12} /> Potential
                      </div>
                  </div>
              </div>
           </div>

           {/* Recent Activity Feed */}
           <div className="glass-dark rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <TrendingUp size={20} className="text-blue-400" /> Recent Upgrades
                </h3>
                <div className="space-y-4">
                    {stats.recentUpgrades?.length > 0 ? (
                        stats.recentUpgrades.map((user, i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                <div className="flex items-center gap-4">
                                     <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                                        {user.email[0].toUpperCase()}
                                     </div>
                                     <div>
                                        <p className="text-white font-medium">{user.email}</p>
                                        <p className="text-xs text-gray-500">{user.snapId || 'No ID'}</p>
                                     </div>
                                </div>
                                <div className="text-right">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase mb-1 inline-block ${
                                        user.subscription?.tier === 'business' ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-500/20 text-purple-400'
                                    }`}>
                                        {user.subscription?.tier}
                                    </span>
                                    <p className="text-xs text-gray-400">{formatDate(user.subscription?.currentPeriodStart)}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500 text-center py-4">No recent upgrades found.</p>
                    )}
                </div>
           </div>
        </div>
      )}

      {/* Subscribers Tab */}
      {activeTab === 'subscribers' && (
          <div className="space-y-6">
               <div className="glass-dark rounded-2xl border border-white/10 overflow-hidden">
                    <GlassTable headers={['User', 'Plan', 'Billing', 'Status', 'Next Bill', 'Joined']}>
                        {subsLoading ? (
                             <tr><td colSpan="6" className="p-8 text-center text-gray-500">Loading subscribers...</td></tr>
                        ) : subscribers.length === 0 ? (
                             <tr><td colSpan="6" className="p-8 text-center text-gray-500">No active subscribers found.</td></tr>
                        ) : (
                            subscribers.map(sub => (
                                <tr key={sub._id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-xs font-bold text-white">
                                                {sub.firstName ? sub.firstName[0] : sub.email[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-white text-sm font-medium">{sub.email}</div>
                                                <div className="flex gap-2">
                                                    {sub.snapId && <span className="text-[10px] text-gray-500 bg-white/5 px-1 rounded">{sub.snapId}</span>}
                                                    {sub.eliteId && <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1 rounded border border-amber-500/20">ELITE</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            {sub.subscription?.tier === 'business' ? (
                                                <Zap size={14} className="text-amber-400" />
                                            ) : (
                                                <Crown size={14} className="text-purple-400" />
                                            )}
                                            <span className={`text-sm font-medium capitalize ${
                                                sub.subscription?.tier === 'business' ? 'text-amber-400' : 'text-purple-300'
                                            }`}>
                                                {sub.subscription?.tier}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-gray-300 text-sm capitalize">{sub.subscription?.billingCycle || 'Monthly'}</span>
                                    </td>
                                    <td className="p-4">
                                         {sub.subscription?.status === 'active' ? (
                                             <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                                 Active
                                             </span>
                                         ) : sub.subscription?.status === 'paused' ? (
                                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                                 Paused
                                             </span>
                                         ) : (
                                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                                 {sub.subscription?.status || 'Unknown'}
                                             </span>
                                         )}
                                    </td>
                                    <td className="p-4 text-gray-400 text-sm">
                                        {sub.subscription?.billingCycle === 'lifetime' 
                                            ? <span className="text-blue-400 font-medium">Lifetime</span>
                                            : formatDate(sub.subscription?.currentPeriodEnd)
                                        }
                                    </td>
                                    <td className="p-4 text-gray-500 text-sm">
                                        {formatDate(sub.createdAt)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </GlassTable>
               </div>
               
               {/* Pagination */}
               {subsTotalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                        <button onClick={() => fetchSubscribers(subsPage - 1)} disabled={subsPage === 1} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white"><ChevronLeft size={20}/></button>
                        <span className="px-4 py-2 text-gray-400">Page {subsPage} of {subsTotalPages}</span>
                        <button onClick={() => fetchSubscribers(subsPage + 1)} disabled={subsPage === subsTotalPages} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white"><ChevronRight size={20}/></button>
                    </div>
               )}
          </div>
      )}

      {/* Redeem Codes Tab (Legacy) */}
      {activeTab === 'codes' && (
         <div className="space-y-4">
           {/* Actions */}
           <div className="flex justify-end items-center mb-4">
             <button
               onClick={() => fetchCodes(codesPage)}
               className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white transition-colors"
             >
               <RefreshCw size={16} className={codesLoading ? 'animate-spin' : ''} />
               Refresh
             </button>
           </div>

           <div className="glass-dark rounded-xl border border-white/10 overflow-hidden">
             <table className="w-full">
               <thead className="bg-white/5">
                 <tr>
                   <th className="text-left px-4 py-3 text-gray-400 font-medium text-sm">Code</th>
                   <th className="text-left px-4 py-3 text-gray-400 font-medium text-sm">Tier</th>
                   <th className="text-left px-4 py-3 text-gray-400 font-medium text-sm">Expires</th>
                   <th className="text-left px-4 py-3 text-gray-400 font-medium text-sm">Usage</th>
                   <th className="text-left px-4 py-3 text-gray-400 font-medium text-sm">Status</th>
                   <th className="text-right px-4 py-3 text-gray-400 font-medium text-sm">Actions</th>
                 </tr>
               </thead>
               <tbody>
                 {codes.length === 0 ? (
                   <tr>
                     <td colSpan={6} className="text-center py-8 text-gray-500">
                       No redeem codes found.
                     </td>
                   </tr>
                 ) : (
                   codes.map((code) => (
                     <tr key={code._id} className="border-t border-white/5 hover:bg-white/5">
                       <td className="px-4 py-3">
                         <div className="flex flex-col">
                             <code className="bg-black/30 px-2 py-1 rounded text-sm font-mono text-blue-400 w-fit">
                             {code.code}
                             </code>
                             {code.notes && <span className="text-[10px] text-gray-500 mt-1 truncate max-w-[150px]">{code.notes}</span>}
                         </div>
                       </td>
                       <td className="px-4 py-3">
                         <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                           code.tier === 'pro' ? 'bg-purple-500/20 text-purple-400' : 'bg-amber-500/20 text-amber-400'
                         }`}>
                           {code.tier}
                         </span>
                       </td>
                       <td className="px-4 py-3 text-gray-300">
                         {code.expiresAt ? <span className="text-red-400">{formatDate(code.expiresAt)}</span> : 'Never'}
                       </td>
                       <td className="px-4 py-3 text-gray-300">{code.usedCount} / {code.maxUses}</td>
                       <td className="px-4 py-3">
                         <span className={`px-2 py-1 rounded text-xs font-bold ${
                           code.isValid 
                             ? 'bg-green-500/20 text-green-400' 
                             : 'bg-red-500/20 text-red-400'
                         }`}>
                           {code.isValid ? 'Active' : 'Inactive'}
                         </span>
                       </td>
                       <td className="px-4 py-3 text-right">
                         <div className="flex justify-end gap-2">
                           <button
                             onClick={() => handleCopyCode(code.code)}
                             className="p-2 text-gray-400 hover:text-white transition-colors"
                             title="Copy code"
                           >
                             <Copy size={16} />
                           </button>
                           {code.isActive && (
                             <button
                               onClick={() => handleDeactivateCode(code._id, code.code)}
                               className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                               title="Deactivate"
                             >
                               <Trash2 size={16} />
                             </button>
                           )}
                         </div>
                       </td>
                     </tr>
                   ))
                 )}
               </tbody>
             </table>
           </div>
         </div>
      )}

      <GenerateCodeModal 
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onCodeGenerated={() => fetchCodes(1)}
      />
    </div>
  );
};

export default AdminSubscriptions;
