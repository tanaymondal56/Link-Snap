import { useState } from 'react';
import { 
  Smartphone, 
  Monitor, 
  Tablet,
  Apple,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  Crown,
  Target,
  Info,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProBadge } from './subscription/PremiumField';

// Device options with icons and colors
const DEVICE_OPTIONS = [
  { value: 'ios', label: 'iOS', icon: Apple, color: 'text-gray-400', bg: 'bg-gray-500/20' },
  { value: 'android', label: 'Android', icon: Smartphone, color: 'text-green-400', bg: 'bg-green-500/20' },
  { value: 'mobile', label: 'Mobile (Generic)', icon: Smartphone, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  { value: 'tablet', label: 'Tablet', icon: Tablet, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  { value: 'desktop', label: 'Desktop', icon: Monitor, color: 'text-amber-400', bg: 'bg-amber-500/20' },
];

// Helper to validate URL
const isValidUrl = (input) => {
  if (!input) return false;
  return /^https?:\/\/[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+/.test(input);
};

const DeviceTargetingSection = ({ 
  deviceRedirects, 
  setDeviceRedirects, 
  isLocked = false,
  upgradePath = '/pricing'
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Get available devices (ones not already added)
  const getAvailableDevices = () => {
    const usedDevices = deviceRedirects.rules.map(r => r.device);
    return DEVICE_OPTIONS.filter(d => !usedDevices.includes(d.value));
  };
 
  // ... (keeping existing functions: addDeviceRule, updateRuleUrl, removeRule) ...

  // Add a new device rule
  const addDeviceRule = (device) => {
    if (isLocked) return;
    
    const deviceOption = DEVICE_OPTIONS.find(d => d.value === device);
    if (!deviceOption) return;

    setDeviceRedirects({
      ...deviceRedirects,
      enabled: true,
      rules: [
        ...deviceRedirects.rules,
        { 
          device, 
          url: '', 
          priority: deviceRedirects.rules.length 
        }
      ]
    });
  };

  // Update a device rule's URL
  const updateRuleUrl = (index, url) => {
    if (isLocked) return;
    
    const newRules = [...deviceRedirects.rules];
    newRules[index] = { ...newRules[index], url };
    setDeviceRedirects({ ...deviceRedirects, rules: newRules });
  };

  // Remove a device rule
  const removeRule = (index) => {
    if (isLocked) return;
    
    const newRules = deviceRedirects.rules.filter((_, i) => i !== index);
    setDeviceRedirects({ 
      ...deviceRedirects, 
      rules: newRules,
      enabled: newRules.length > 0
    });
  };

  const availableDevices = getAvailableDevices();

  return (
    <div 
      className="relative"
      onMouseEnter={() => isLocked && setShowUpgradePrompt(true)}
      onMouseLeave={() => setShowUpgradePrompt(false)}
    >
      {/* Header with toggle */}
      <div 
        className={`flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer ${
          isLocked 
            ? 'border-gray-700/50 bg-gray-800/30 opacity-60' 
            : deviceRedirects.enabled 
              ? 'border-cyan-500/50 bg-cyan-500/10' 
              : 'border-gray-700/50 bg-gray-800/30 hover:bg-gray-800/50'
        }`}
        onClick={!isLocked ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${deviceRedirects.enabled ? 'bg-cyan-500/20' : 'bg-gray-700/50'}`}>
            <Target size={18} className={deviceRedirects.enabled ? 'text-cyan-400' : 'text-gray-400'} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Device Targeting</span>
              {isLocked ? <ProBadge /> : <Crown size={14} className="text-amber-400" />}
            </div>
            <p className="text-xs text-gray-500">
              {deviceRedirects.rules.length > 0 
                ? `${deviceRedirects.rules.length} device rule${deviceRedirects.rules.length > 1 ? 's' : ''} configured`
                : 'Redirect to different URLs based on device'
              }
            </p>
          </div>
        </div>
        
        {/* Toggle button & Info */}
        <div className="flex items-center gap-2">
          {!isLocked && (
             <button 
               type="button"
               onClick={(e) => { 
                 e.stopPropagation(); 
                 if (!showInfo) setIsExpanded(true);
                 setShowInfo(!showInfo); 
               }}
               className={`p-2 -m-1 rounded-full transition-all ${
                 showInfo 
                   ? 'text-amber-400 bg-amber-500/20 ring-1 ring-amber-500/50' 
                   : 'text-amber-400/80 bg-amber-500/10 hover:text-amber-400 hover:bg-amber-500/20'
               }`}
               title="How priority works"
             >
               <HelpCircle size={18} />
             </button>
          )}
          {!isLocked && deviceRedirects.rules.length > 0 && (
             <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeviceRedirects({ ...deviceRedirects, enabled: !deviceRedirects.enabled });
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                  deviceRedirects.enabled ? 'bg-cyan-500' : 'bg-gray-700'
                }`}
                title={deviceRedirects.enabled ? "Turn off device targeting" : "Turn on device targeting"}
              >
                <span
                  className={`${
                    deviceRedirects.enabled ? 'translate-x-6' : 'translate-x-1'
                  } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                />
              </button>
          )}
          {!isLocked && (isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />)}
        </div>
      </div>

      {/* Upgrade prompt overlay */}
      {showUpgradePrompt && isLocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm rounded-xl z-20">
          <Link
            to={upgradePath}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-cyan-500/30 transition-all"
          >
            <Crown size={16} />
            Upgrade to Pro
          </Link>
        </div>
      )}

      {/* Expandable content */}
      {isExpanded && !isLocked && (
        <div className="mt-3 space-y-3 animate-fade-in">
          
          {/* Priority Info Card */}
          {showInfo && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-200/90 mb-3 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-2 mb-2 font-semibold text-amber-400">
                    <Info size={16} />
                    How Priority Works
                </div>
                <ul className="space-y-1.5 text-xs text-amber-100/70 list-decimal list-outside ml-4">
                    <li><strong className="text-amber-50">Specific Rules First:</strong> We check for <strong>iOS/Android</strong> rules first.</li>
                    <li><strong className="text-amber-50">General Rules Next:</strong> Then we check for <strong>Mobile/Tablet</strong> rules.</li>
                    <li><strong className="text-amber-50">Main Link Last:</strong> If no rules match, users go to your main link.</li>
                </ul>
            </div>
          )}

          {/* Existing rules */}
          {deviceRedirects.rules.map((rule, index) => {
            const deviceOption = DEVICE_OPTIONS.find(d => d.value === rule.device);
            const DeviceIcon = deviceOption?.icon || Smartphone;
            const isValidRuleUrl = isValidUrl(rule.url);
            
            return (
              <div key={rule.device} className="flex flex-wrap sm:flex-nowrap items-center sm:items-start gap-2 bg-gray-800/20 p-2 sm:p-0 rounded-xl sm:rounded-none border sm:border-0 border-white/5">
                {/* Device badge */}
                <div className={`order-1 flex items-center justify-center sm:justify-start gap-2 px-3 py-2.5 rounded-lg ${deviceOption?.bg} border border-white/10 flex-1 sm:flex-none sm:w-auto sm:min-w-[120px]`}>
                  <DeviceIcon size={16} className={deviceOption?.color} />
                  <span className="text-sm text-white font-medium whitespace-nowrap">{deviceOption?.label}</span>
                </div>
                
                {/* Remove button - Mobile: Top Right (Order 2), Desktop: Far Right (Order 3) */}
                <button
                  type="button"
                  onClick={() => removeRule(index)}
                  className="order-2 sm:order-3 p-3 sm:p-2.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors bg-gray-800/50 sm:bg-transparent"
                  aria-label="Remove rule"
                >
                  <X size={18} />
                </button>

                {/* URL input - Mobile: Bottom (Order 3), Desktop: Middle (Order 2) */}
                <div className="order-3 sm:order-2 w-full sm:w-auto sm:flex-1 relative">
                  <input
                    type="text"
                    value={rule.url}
                    onChange={(e) => updateRuleUrl(index, e.target.value)}
                    placeholder="https://example.com/mobile-page"
                    className={`w-full bg-gray-800/50 border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors ${
                      rule.url && isValidRuleUrl 
                        ? 'border-green-500/50' 
                        : rule.url && !isValidRuleUrl 
                          ? 'border-red-500/50' 
                          : 'border-gray-700 focus:border-cyan-500'
                    }`}
                  />
                </div>
              </div>
            );
          })}

          {/* Add device button */}
          {availableDevices.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-700 rounded-lg text-gray-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors"
              >
                <Plus size={16} />
                <span className="text-sm">Add Device Rule</span>
                {isDropdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              
              {/* Backdrop to close dropdown when clicking outside */}
              {isDropdownOpen && (
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setIsDropdownOpen(false)}
                />
              )}
              
              {/* Dropdown menu - Opens Upwards to prevent cutoff */}
              {isDropdownOpen && (
                <div className="absolute left-0 right-0 bottom-full mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-40 animate-fade-in max-h-60 overflow-y-auto">
                  {availableDevices.map((device) => {
                    const DeviceIcon = device.icon;
                    return (
                      <button
                        key={device.value}
                        type="button"
                        onClick={() => {
                          addDeviceRule(device.value);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-700/50 transition-colors"
                      >
                        <DeviceIcon size={16} className={device.color} />
                        <span className="text-sm text-white">{device.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tablet fallback note */}
          {deviceRedirects.rules.some(r => r.device === 'mobile') && !deviceRedirects.rules.some(r => r.device === 'tablet') && (
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <Tablet size={12} />
              Tablets will use the Mobile URL if no Tablet rule is set
            </p>
          )}

          {/* Default Redirection Note */}
          {deviceRedirects.rules.length > 0 && (
            <div className="pt-2 border-t border-gray-700/50">
              <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
                <Info size={14} className="shrink-0 mt-0.5 text-gray-500" />
                <span>
                 If a visitor's device <strong>doesn't match any of the rules above</strong>, they will automatically be redirected to your main <strong>Destination URL</strong> (the one you set at the very top).
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeviceTargetingSection;
