import { useState, useEffect, useCallback } from 'react';
import { Activity, Database, CheckCircle, XCircle, AlertTriangle, RefreshCw, Clock, Server } from 'lucide-react';
import api from '../../api/axios';

const SystemHealthCard = () => {
  const [health, setHealth] = useState(null);
  const [deepHealth, setDeepHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    console.log('[SystemHealth] Starting health check...');
    
    try {
      // Check both endpoints using axios api instance
      const [basicRes, deepRes] = await Promise.allSettled([
        api.get('/health'),
        api.get('/health/deep'),
      ]);

      console.log('[SystemHealth] Basic health response:', basicRes);
      console.log('[SystemHealth] Deep health response:', deepRes);

      if (basicRes.status === 'fulfilled') {
        console.log('[SystemHealth] Setting health:', basicRes.value.data);
        setHealth(basicRes.value.data);
      } else {
        console.log('[SystemHealth] Basic health failed:', basicRes.reason);
        setHealth({ status: 'error', error: basicRes.reason?.message });
      }

      if (deepRes.status === 'fulfilled') {
        console.log('[SystemHealth] Setting deepHealth:', deepRes.value.data);
        setDeepHealth(deepRes.value.data);
      } else {
        console.log('[SystemHealth] Deep health failed:', deepRes.reason);
        setDeepHealth({ status: 'error', error: deepRes.reason?.message });
      }

      setLastChecked(new Date());
    } catch (err) {
      console.error('[SystemHealth] Error:', err);
      setError(err.message || 'Failed to check health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ok': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'degraded': return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-400" />;
      default: return <Activity className="w-5 h-5 text-gray-400 animate-pulse" />;
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      ok: 'bg-green-500/20 text-green-400 border-green-500/30',
      degraded: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      error: 'bg-red-500/20 text-red-400 border-red-500/30',
      connected: 'bg-green-500/20 text-green-400 border-green-500/30',
      disconnected: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-white">System Health</h3>
        </div>
        <button
          onClick={checkHealth}
          disabled={loading}
          className="p-1.5 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors disabled:opacity-50"
          title="Refresh health status"
        >
          <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {/* API Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50">
          <div className="flex items-center gap-3">
            <Server className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">API Server</span>
          </div>
          <div className="flex items-center gap-2">
            {loading ? (
              <span className="text-xs text-gray-500">Checking...</span>
            ) : (
              <>
                <span className={`px-2 py-0.5 rounded-full text-xs border ${getStatusBadge(health?.status)}`}>
                  {health?.status?.toUpperCase() || 'UNKNOWN'}
                </span>
                {getStatusIcon(health?.status)}
              </>
            )}
          </div>
        </div>

        {/* Database Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50">
          <div className="flex items-center gap-3">
            <Database className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">Database</span>
          </div>
          <div className="flex items-center gap-2">
            {loading ? (
              <span className="text-xs text-gray-500">Checking...</span>
            ) : (
              <>
                <span className={`px-2 py-0.5 rounded-full text-xs border ${getStatusBadge(deepHealth?.services?.database)}`}>
                  {deepHealth?.services?.database?.toUpperCase() || 'UNKNOWN'}
                </span>
                {getStatusIcon(deepHealth?.services?.database === 'connected' ? 'ok' : 'error')}
              </>
            )}
          </div>
        </div>

        {/* Uptime */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">Uptime</span>
          </div>
          <span className="text-sm text-gray-400">
            {loading ? '...' : formatUptime(health?.uptime)}
          </span>
        </div>
      </div>

      {/* Last checked time */}
      {lastChecked && (
        <div className="mt-3 pt-3 border-t border-gray-700/50">
          <p className="text-xs text-gray-500 text-center">
            Last checked: {lastChecked.toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
};

export default SystemHealthCard;
