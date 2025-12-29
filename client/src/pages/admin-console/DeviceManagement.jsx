import { useState, useEffect, useCallback } from 'react';
import { 
  Smartphone, 
  Monitor, 
  Tablet, 
  Fingerprint, 
  Trash2, 
  RefreshCw,
  Plus,
  Shield,
  MapPin,
  Clock,
  AlertTriangle,
  Check,
  X,
  Loader2
} from 'lucide-react';
import BentoCard from '../../components/admin-console/ui/BentoCard';
import showToast from '../../components/ui/Toast';
import {
  getDevices,
  registerDevice,
  revokeDevice,
  revokeAllDevices,
  supportsWebAuthn,
  getDeviceInfo
} from '../../utils/deviceAuth';

// Helper functions (outside component for purity)
const formatDate = (date) => {
  if (!date) return 'Never';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const isDeviceInactive = (device) => {
  if (!device.updatedAt) return false;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return new Date(device.updatedAt).getTime() < thirtyDaysAgo;
};

const DeviceManagement = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [showRevokeAll, setShowRevokeAll] = useState(false);
  const [revokeConfirmText, setRevokeConfirmText] = useState('');
  const [revokingAll, setRevokingAll] = useState(false);
  
  // Custom confirm modal state (replaces native confirm)
  const [revokeConfirmModal, setRevokeConfirmModal] = useState({ show: false, deviceId: null, deviceName: '' });

  // Check WebAuthn support
  const webAuthnSupported = supportsWebAuthn();
  const currentDeviceInfo = getDeviceInfo();

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    const result = await getDevices();
    if (result.success) {
      setDevices(result.devices);
    } else {
      showToast.error('Failed to load devices');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleRegisterDevice = async () => {
    if (!webAuthnSupported) {
      showToast.error('Biometrics not supported on this device');
      return;
    }

    setRegistering(true);
    const result = await registerDevice();
    
    if (result.success) {
      showToast.success('Device registered successfully!');
      fetchDevices();
    } else if (result.error !== 'cancelled') {
      showToast.error(result.error || 'Registration failed');
    }
    setRegistering(false);
  };

  const handleRevokeDevice = async (deviceId, deviceName) => {
    // Show custom confirm modal instead of native confirm
    setRevokeConfirmModal({ show: true, deviceId, deviceName });
  };

  const confirmRevokeDevice = async () => {
    const { deviceId, deviceName } = revokeConfirmModal;
    setRevokeConfirmModal({ show: false, deviceId: null, deviceName: '' });

    setRevoking(deviceId);
    const result = await revokeDevice(deviceId);
    
    if (result.success) {
      showToast.success(`${deviceName} revoked`);
      fetchDevices();
    } else {
      showToast.error(result.error || 'Failed to revoke device');
    }
    setRevoking(null);
  };

  const handleRevokeAll = async () => {
    if (revokeConfirmText !== 'REVOKE ALL') {
      showToast.warning('Type "REVOKE ALL" to confirm');
      return;
    }

    setRevokingAll(true);
    const result = await revokeAllDevices();
    
    if (result.success) {
      showToast.success('All devices revoked');
      setShowRevokeAll(false);
      setRevokeConfirmText('');
      fetchDevices();
    } else {
      showToast.error(result.error || 'Failed to revoke devices');
    }
    setRevokingAll(false);
  };

  const getDeviceIcon = (device) => {
    const model = device.deviceModel?.toLowerCase() || '';
    if (model.includes('iphone') || model.includes('android')) {
      return <Smartphone className="h-6 w-6" />;
    }
    if (model.includes('ipad') || model.includes('tablet')) {
      return <Tablet className="h-6 w-6" />;
    }
    return <Monitor className="h-6 w-6" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="h-7 w-7 text-purple-400" />
            Trusted Devices
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage devices that can access admin panel via biometrics
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchDevices}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 text-sm transition-all"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleRegisterDevice}
            disabled={registering || !webAuthnSupported}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50"
          >
            {registering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Register This Device
          </button>
        </div>
      </div>

      {/* WebAuthn Support Warning */}
      {!webAuthnSupported && (
        <BentoCard className="border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-medium">Biometrics Not Supported</p>
              <p className="text-gray-400 text-sm mt-1">
                This browser doesn't support WebAuthn. Try Chrome, Safari, or Edge.
              </p>
            </div>
          </div>
        </BentoCard>
      )}

      {/* Current Device Info */}
      <BentoCard>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Fingerprint className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <p className="text-white font-medium">Current Device</p>
            <p className="text-gray-400 text-sm">
              {currentDeviceInfo.model} • {currentDeviceInfo.os} • {currentDeviceInfo.browser}
            </p>
          </div>
        </div>
      </BentoCard>

      {/* Device List */}
      <div className="space-y-4">
        {loading ? (
          <BentoCard>
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
            </div>
          </BentoCard>
        ) : devices.length === 0 ? (
          <BentoCard>
            <div className="text-center py-8">
              <Shield className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No trusted devices registered</p>
              <p className="text-gray-500 text-sm mt-2">
                Register this device to enable biometric access from any network
              </p>
            </div>
          </BentoCard>
        ) : (
          devices.map((device) => (
            <BentoCard 
              key={device._id}
              className={`${!device.isActive ? 'opacity-50' : ''} ${isDeviceInactive(device) ? 'border-yellow-500/20' : ''}`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Device Info */}
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl ${device.isActive ? 'bg-purple-500/20' : 'bg-gray-500/20'} flex items-center justify-center shrink-0`}>
                    {getDeviceIcon(device)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-medium truncate">
                        {device.deviceName}
                      </h3>
                      {!device.isActive && (
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                          Revoked
                        </span>
                      )}
                      {device.isActive && isDeviceInactive(device) && (
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm">
                      {device.deviceModel} • {device.deviceOS} • {device.browser}
                    </p>
                    
                    {/* IP Info */}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Registered: {device.registeredIP || 'Unknown'}
                        {device.registeredGeo?.city && ` (${device.registeredGeo.city})`}
                      </span>
                      {device.lastAccessIP && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last: {device.lastAccessIP}
                          {device.lastAccessGeo?.city && ` (${device.lastAccessGeo.city})`}
                        </span>
                      )}
                    </div>
                    
                    {/* Timestamps */}
                    <div className="mt-1 text-xs text-gray-600">
                      Registered {formatDate(device.createdAt)} • Last used {formatDate(device.updatedAt)}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {device.isActive && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRevokeDevice(device._id, device.deviceName)}
                      disabled={revoking === device._id}
                      className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-sm transition-all"
                    >
                      {revoking === device._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Revoke
                    </button>
                  </div>
                )}
              </div>
            </BentoCard>
          ))
        )}
      </div>

      {/* Emergency Revoke All */}
      {devices.filter(d => d.isActive).length > 0 && (
        <BentoCard className="border-red-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-red-400 font-medium flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Emergency: Revoke All Devices
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                Immediately revoke all {devices.filter(d => d.isActive).length} trusted devices
              </p>
            </div>
            {!showRevokeAll ? (
              <button
                onClick={() => setShowRevokeAll(true)}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-sm transition-all"
              >
                Revoke All
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder='Type "REVOKE ALL"'
                  value={revokeConfirmText}
                  onChange={(e) => setRevokeConfirmText(e.target.value)}
                  className="px-3 py-2 bg-white/5 border border-red-500/30 rounded-lg text-white text-sm w-40 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
                <button
                  onClick={handleRevokeAll}
                  disabled={revokingAll || revokeConfirmText !== 'REVOKE ALL'}
                  className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all disabled:opacity-50"
                >
                  {revokingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => {
                    setShowRevokeAll(false);
                    setRevokeConfirmText('');
                  }}
                  className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </BentoCard>
      )}

      {/* Custom Confirm Modal (replaces native confirm) */}
      {revokeConfirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900/95 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Revoke Device?</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Are you sure you want to revoke <span className="text-white font-medium">"{revokeConfirmModal.deviceName}"</span>? 
              This device will lose admin access.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRevokeConfirmModal({ show: false, deviceId: null, deviceName: '' })}
                className="flex-1 py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmRevokeDevice}
                className="flex-1 py-2.5 px-4 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium transition-all"
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <BentoCard className="bg-purple-500/5 border-purple-500/20">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-400">
            <p className="font-medium text-purple-400 mb-1">How it works</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Register devices from a whitelisted IP</li>
              <li>Access admin from any network using biometrics</li>
              <li>Device keys are stored securely in your device's hardware</li>
              <li>Revoke devices instantly if lost or stolen</li>
            </ul>
          </div>
        </div>
      </BentoCard>
    </div>
  );
};

export default DeviceManagement;
