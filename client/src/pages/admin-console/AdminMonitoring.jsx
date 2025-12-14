import { useState, useEffect, useCallback, useRef } from 'react';
import { usePersistentTab } from '../../hooks/usePersistentTab';
import { 
  Activity, 
  Server, 
  Database, 
  Clock, 
  RefreshCw, 
  FileText, 
  BarChart2, 
  CheckCircle, 
  AlertTriangle, 
  XCircle 
} from 'lucide-react';
import api from '../../api/axios';
import { formatDateTime } from '../../utils/dateUtils';
import BentoCard from '../../components/admin-console/ui/BentoCard';
import showToast from '../../components/ui/Toast';

const AdminMonitoring = () => {
  const [activeTab, setActiveTab] = usePersistentTab('admin_monitoring', 'health', ['health', 'logs', 'performance']);
  const [health, setHealth] = useState(null);
  const [deepHealth, setDeepHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);
  const hasFetched = useRef(false); // Prevent double-fetch in StrictMode

  const checkHealth = useCallback(async (showSuccessToast = false) => {
    setLoading(true);
    try {
      const [basicRes, deepRes] = await Promise.allSettled([
        api.get('/health'),
        api.get('/health/deep'),
      ]);

      if (basicRes.status === 'fulfilled') {
        setHealth(basicRes.value.data);
      } else {
        setHealth({ status: 'error', error: basicRes.reason?.message });
      }

      if (deepRes.status === 'fulfilled') {
        setDeepHealth(deepRes.value.data);
      } else {
        setDeepHealth({ status: 'error', error: deepRes.reason?.message });
      }

      setLastChecked(new Date());
      // Only show toast for manual refresh, not on initial mount
      if (showSuccessToast) {
        showToast.success('Health status updated');
      }
    } catch {
      showToast.error('Failed to check health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'health' && !hasFetched.current) {
      hasFetched.current = true;
      checkHealth(false); // Don't show toast on initial mount
    }
  }, [activeTab, checkHealth]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'ok': return 'text-green-400';
      case 'degraded': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ok': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'degraded': return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-400" />;
      default: return <Activity className="w-5 h-5 text-gray-400 animate-pulse" />;
    }
  };

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
          Monitoring
        </h1>
        <p className="text-gray-400 mt-1">Real-time system health and logs</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700/50 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('health')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'health' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Activity size={16} /> System Health
        </button>
        {/* Logs and Performance tabs hidden until backend support is implemented */}
      </div>

      {/* Content */}
      <div className="animate-fade-in">
        {activeTab === 'health' && (
          <div className="space-y-6">
             <div className="flex justify-end">
               <button
                 onClick={() => checkHealth(true)}
                 disabled={loading}
                 className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 border border-gray-700"
               >
                 <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                 Refresh Status
               </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {/* API Status */}
               <BentoCard title="API Server" icon={Server}>
                 <div className="mt-4 flex flex-col gap-2">
                   <div className="flex items-center justify-between">
                     <span className="text-gray-400 text-sm">Status</span>
                     <div className="flex items-center gap-2">
                       {getStatusIcon(health?.status)}
                       <span className={`text-sm font-medium uppercase ${getStatusColor(health?.status)}`}>
                         {health?.status || 'Unknown'}
                       </span>
                     </div>
                   </div>
                   <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2 overflow-hidden">
                     <div className={`h-full ${health?.status === 'ok' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} style={{ width: '100%' }} />
                   </div>
                 </div>
               </BentoCard>

               {/* Database Status */}
               <BentoCard title="Database" icon={Database}>
                 <div className="mt-4 flex flex-col gap-2">
                   <div className="flex items-center justify-between">
                     <span className="text-gray-400 text-sm">Status</span>
                     <div className="flex items-center gap-2">
                       {getStatusIcon(deepHealth?.services?.database === 'connected' ? 'ok' : 'error')}
                       <span className={`text-sm font-medium uppercase ${deepHealth?.services?.database === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
                         {deepHealth?.services?.database || 'Unknown'}
                       </span>
                     </div>
                   </div>
                   <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2 overflow-hidden">
                     <div 
                        className={`h-full ${deepHealth?.services?.database === 'connected' ? 'bg-green-500' : 'bg-red-500'} transition-all duration-500`} 
                        style={{ width: deepHealth?.services?.database === 'connected' ? '100%' : '0%' }} 
                     />
                   </div>
                 </div>
               </BentoCard>

               {/* Uptime */}
               <BentoCard title="Uptime" icon={Clock}>
                 <div className="mt-4">
                   <h3 className="text-2xl font-bold text-white font-mono">
                     {formatUptime(health?.uptime)}
                   </h3>
                   <p className="text-xs text-gray-500 mt-1">
                     Since last restart
                   </p>
                 </div>
               </BentoCard>
             </div>

             {/* Raw Data View */}
             <BentoCard title="Detailed Diagnostics" className="font-mono text-xs">
               <pre className="overflow-x-auto text-gray-300">
                 {JSON.stringify({ basic: health, deep: deepHealth }, null, 2)}
               </pre>
               {lastChecked && (
                 <p className="text-gray-500 mt-4 text-right">
                   Last checked: {formatDateTime(lastChecked)}
                 </p>
               )}
             </BentoCard>
          </div>
        )}

        {/* Placeholders for Logs and Performance */}
        {(activeTab === 'logs' || activeTab === 'performance') && (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-gray-700 rounded-2xl bg-gray-900/20">
            {activeTab === 'logs' ? (
              <FileText className="w-16 h-16 text-gray-600 mb-4" />
            ) : (
              <BarChart2 className="w-16 h-16 text-gray-600 mb-4" />
            )}
            <h3 className="text-xl font-bold text-gray-300 mb-2">Module Coming Soon</h3>
            <p className="text-gray-500 max-w-sm text-center">
              This advanced monitoring feature is currently under development (Placeholder matches legacy panel).
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMonitoring;
