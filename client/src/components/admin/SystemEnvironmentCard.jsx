import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
  Server,
  HardDrive,
  Cpu,
  Box,
  Terminal,
  Activity,
  Network,
  Code,
  Clock,
  Shield,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import showToast from '../../utils/toastUtils';

const SystemEnvironmentCard = () => {
  const { isAuthChecking } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('kubernetes');
  const [envSearch, setEnvSearch] = useState('');

  useEffect(() => {
    if (isAuthChecking) return;

    const fetchEnv = async () => {
      try {
        const response = await api.get('/admin/system-environment');
        setData(response.data);
      } catch (error) {
        console.error('Error fetching system environment:', error);
        showToast.error('Failed to load system environment data');
      } finally {
        setLoading(false);
      }
    };
    fetchEnv();
  }, [isAuthChecking]);

  if (loading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!data) return null;

  const { kubernetes, hardwareAndOS, runtime, environment } = data;

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const memUsagePercent = ((hardwareAndOS.totalMemory - hardwareAndOS.freeMemory) / hardwareAndOS.totalMemory) * 100;

  const filteredEnv = Object.entries(environment).filter(([key]) =>
    key.toLowerCase().includes(envSearch.toLowerCase())
  );

  const tabs = [
    { id: 'kubernetes', label: 'Kubernetes', icon: Box },
    { id: 'hardware', label: 'Hardware & OS', icon: HardDrive },
    { id: 'runtime', label: 'Runtime', icon: Terminal },
    { id: 'environment', label: 'Environment Config', icon: Code }
  ];

  return (
    <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden mt-6">
      <div className="p-6 border-b border-gray-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <Server className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Cluster & System Information</h2>
            <p className="text-sm text-gray-400">Detailed diagnostics and node specifications</p>
          </div>
        </div>
      </div>

      <div className="flex overflow-x-auto border-b border-gray-700/50">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
                isActive
                  ? 'text-cyan-400 border-cyan-400 bg-cyan-500/5'
                  : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="p-6">
        {/* Kubernetes Tab */}
        {activeTab === 'kubernetes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem icon={Box} label="Pod Name" value={kubernetes.podName} />
            <InfoItem icon={Network} label="Namespace" value={kubernetes.namespace} />
            <InfoItem icon={Server} label="Node Name" value={kubernetes.nodeName} />
            <InfoItem icon={Shield} label="Service Account" value={kubernetes.serviceAccount} />
            <InfoItem icon={Network} label="Pod IP" value={kubernetes.podIp} />
            <InfoItem icon={Server} label="Host IP" value={kubernetes.hostIp} />
            <div className="md:col-span-2">
              <InfoItem icon={Code} label="Pod UID" value={kubernetes.podUid} copyable />
            </div>
          </div>
        )}

        {/* Hardware Tab */}
        {activeTab === 'hardware' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoItem icon={Server} label="Hostname" value={hardwareAndOS.hostname} />
              <InfoItem icon={Terminal} label="Platform" value={`${hardwareAndOS.type} (${hardwareAndOS.platform} ${hardwareAndOS.release})`} />
              <InfoItem icon={Cpu} label="Architecture" value={hardwareAndOS.arch} />
              <InfoItem icon={Cpu} label="CPU Model" value={`${hardwareAndOS.cpus}x ${hardwareAndOS.cpuModel}`} />
            </div>

            <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-700/50">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400 font-medium flex items-center gap-2">
                  <HardDrive className="w-4 h-4" /> System Memory
                </span>
                <span className="text-white text-sm">
                  {formatBytes(hardwareAndOS.totalMemory - hardwareAndOS.freeMemory)} / {formatBytes(hardwareAndOS.totalMemory)}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${memUsagePercent > 85 ? 'bg-red-500' : memUsagePercent > 70 ? 'bg-yellow-500' : 'bg-cyan-500'}`}
                  style={{ width: `${memUsagePercent}%` }}
                ></div>
              </div>
            </div>
            
            <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-700/50">
              <span className="text-gray-400 font-medium flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4" /> Load Averages (1m, 5m, 15m)
              </span>
              <div className="flex gap-4">
                {hardwareAndOS.loadAverage.map((avg, i) => (
                  <div key={i} className="bg-gray-800 px-4 py-2 rounded-lg text-white font-mono text-lg">
                    {avg.toFixed(2)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Runtime Tab */}
        {activeTab === 'runtime' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem icon={Terminal} label="Node.js Version" value={runtime.nodeVersion} />
            <InfoItem icon={Code} label="V8 Engine Version" value={runtime.v8Version} />
            <InfoItem icon={Box} label="Link-Snap App Version" value={runtime.appVersion} />
            <InfoItem icon={Activity} label="Process ID (PID)" value={runtime.pid.toString()} />
            <div className="md:col-span-2">
              <InfoItem icon={Clock} label="Process Uptime" value={formatUptime(runtime.uptime)} />
            </div>
          </div>
        )}

        {/* Environment Tab */}
        {activeTab === 'environment' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search environment variables..."
                value={envSearch}
                onChange={(e) => setEnvSearch(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            <div className="bg-gray-900/80 rounded-xl border border-gray-700/50 max-h-[400px] overflow-y-auto">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 font-medium">Variable Key</th>
                    <th className="px-6 py-3 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredEnv.length > 0 ? (
                    filteredEnv.map(([key, value]) => (
                      <tr key={key} className="hover:bg-white/5 font-mono">
                        <td className="px-6 py-3 text-cyan-400">{key}</td>
                        <td className="px-6 py-3">
                          {value === '[REDACTED]' ? (
                            <span className="text-red-400/80 italic flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> [REDACTED]
                            </span>
                          ) : (
                            <span className="text-gray-300 break-all">{value}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="2" className="px-6 py-8 text-center text-gray-500">
                        No environment variables found matching "{envSearch}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Reusable Info Item Component
const InfoItem = ({ icon: Icon, label, value }) => {
  return (
    <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4 flex items-start gap-3">
      <div className="p-2 bg-gray-800 rounded-lg text-gray-400 shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
        <p className="text-sm text-white font-mono truncate" title={value}>
          {value}
        </p>
      </div>
    </div>
  );
};

export default SystemEnvironmentCard;
