import { useState, memo } from 'react';
import { 
  Clock, 
  X, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Crown,
  Globe,
  Info,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProBadge } from './subscription/PremiumField';

// Common timezones with friendly labels
const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'EST/EDT (New York)' },
  { value: 'America/Chicago', label: 'CST/CDT (Chicago)' },
  { value: 'America/Denver', label: 'MST/MDT (Denver)' },
  { value: 'America/Los_Angeles', label: 'PST/PDT (Los Angeles)' },
  { value: 'Europe/London', label: 'GMT/BST (London)' },
  { value: 'Europe/Paris', label: 'CET/CEST (Paris)' },
  { value: 'Europe/Berlin', label: 'CET/CEST (Berlin)' },
  { value: 'Asia/Dubai', label: 'GST (Dubai)' },
  { value: 'Asia/Kolkata', label: 'IST (India)' },
  { value: 'Asia/Singapore', label: 'SGT (Singapore)' },
  { value: 'Asia/Tokyo', label: 'JST (Tokyo)' },
  { value: 'Australia/Sydney', label: 'AEST/AEDT (Sydney)' },
];

// Day options
const DAY_OPTIONS = [
  { value: 0, short: 'S', label: 'Sunday' },
  { value: 1, short: 'M', label: 'Monday' },
  { value: 2, short: 'T', label: 'Tuesday' },
  { value: 3, short: 'W', label: 'Wednesday' },
  { value: 4, short: 'T', label: 'Thursday' },
  { value: 5, short: 'F', label: 'Friday' },
  { value: 6, short: 'S', label: 'Saturday' },
];

// Helper to validate URL
const isValidUrl = (input) => {
  if (!input) return false;
  return /^https?:\/\/.+/.test(input);
};

const TimeRoutingSection = ({ 
  timeRedirects, 
  setTimeRedirects, 
  isLocked = false,
  upgradePath = '/pricing'
}) => {
  const [isExpanded, setIsExpanded] = useState(false);


  // Add a new time rule
  const addRule = () => {
    if (isLocked) return;
    
    setTimeRedirects({
      ...timeRedirects,
      enabled: true,
      rules: [
        ...timeRedirects.rules,
        { 
          startTime: '09:00', 
          endTime: '17:00', 
          days: [1, 2, 3, 4, 5], // Mon-Fri default
          destination: '',
          priority: timeRedirects.rules.length,
          label: ''
        }
      ]
    });
  };

  // Update a rule field
  const updateRule = (index, field, value) => {
    if (isLocked) return;
    
    const newRules = [...timeRedirects.rules];
    newRules[index] = { ...newRules[index], [field]: value };
    setTimeRedirects({ ...timeRedirects, rules: newRules });
  };

  // Toggle a day in a rule
  const toggleDay = (index, day) => {
    if (isLocked) return;
    
    const rule = timeRedirects.rules[index];
    const newDays = rule.days.includes(day)
      ? rule.days.filter(d => d !== day)
      : [...rule.days, day].sort();
    updateRule(index, 'days', newDays);
  };

  // Remove a rule
  const removeRule = (index) => {
    if (isLocked) return;
    
    const newRules = timeRedirects.rules.filter((_, i) => i !== index);
    setTimeRedirects({ 
      ...timeRedirects, 
      rules: newRules,
      enabled: newRules.length > 0
    });
  };


  // Render Locked State (Premium Card)
  if (isLocked) {
    return (
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <Clock size={16} className="text-violet-400" />
          Time Routing
        </label>
        
        <div className="relative group overflow-hidden rounded-xl border border-gray-700 bg-gray-800/30 p-4 transition-all hover:border-violet-500/30">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <h4 className="font-medium text-gray-300 mb-1">Upgrade to Route by Time</h4>
              <p className="text-sm text-gray-500">Redirect users based on time of day or day of week.</p>
            </div>
            <Link 
              to={upgradePath}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-amber-500/30 transition-all"
            >
              <Crown size={16} />
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Render Unlocked State (Accordion)
  return (
    <div className="relative">
      {/* Header with toggle */}
      <div 
        className={`flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer ${
          timeRedirects.enabled 
             ? 'border-violet-500/50 bg-violet-500/10' 
             : 'border-gray-700/50 bg-gray-800/30 hover:bg-gray-800/50'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${timeRedirects.enabled ? 'bg-violet-500/20' : 'bg-gray-700/50'}`}>
            <Clock size={18} className={timeRedirects.enabled ? 'text-violet-400' : 'text-gray-400'} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Time Routing</span>
              <Crown size={14} className="text-amber-400" />
            </div>
            <p className="text-xs text-gray-500">
              {timeRedirects.rules.length > 0 
                ? `${timeRedirects.rules.length} schedule rule${timeRedirects.rules.length > 1 ? 's' : ''} configured`
                : 'Route to different URLs based on time of day'
              }
            </p>
          </div>
        </div>
        
        {/* Toggle button */}
        <div className="flex items-center gap-2">
          {timeRedirects.rules.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTimeRedirects({ ...timeRedirects, enabled: !timeRedirects.enabled });
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
                timeRedirects.enabled ? 'bg-violet-500' : 'bg-gray-700'
              }`}
            >
              <span
                className={`${
                  timeRedirects.enabled ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </button>
          )}
          {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </div>

      {/* Expandable content */}
      {isExpanded && (
        <div className="mt-3 space-y-3 animate-fade-in">
          
          {/* Timezone selector */}
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-violet-400" />
            <select
              value={timeRedirects.timezone}
              onChange={(e) => setTimeRedirects({ ...timeRedirects, timezone: e.target.value })}
              className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
            >
              {[
                // Add user's detected timezone if not present in options
                ...(TIMEZONE_OPTIONS.some(tz => tz.value === timeRedirects.timezone) ? [] : [{ value: timeRedirects.timezone, label: `${timeRedirects.timezone} (Detected)` }]),
                ...TIMEZONE_OPTIONS
              ].map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          {/* Existing rules */}
          {timeRedirects.rules.map((rule, index) => (
            <div key={index} className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-3 space-y-3">
              {/* Rule header */}
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={rule.label}
                  onChange={(e) => updateRule(index, 'label', e.target.value)}
                  placeholder={`Rule ${index + 1}`}
                  className="bg-transparent text-sm text-white font-medium focus:outline-none placeholder-gray-500 w-32"
                />
                <button
                  type="button"
                  onClick={() => removeRule(index)}
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Time range */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  value={rule.startTime}
                  onChange={(e) => updateRule(index, 'startTime', e.target.value)}
                  className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="time"
                  value={rule.endTime}
                  onChange={(e) => updateRule(index, 'endTime', e.target.value)}
                  className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                />
              </div>

              {/* Day pills */}
              <div className="flex flex-wrap gap-1">
                {DAY_OPTIONS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(index, day.value)}
                    className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                      rule.days.includes(day.value)
                        ? 'bg-violet-500 text-white'
                        : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                    }`}
                    title={day.label}
                  >
                    {day.short}
                  </button>
                ))}
              </div>

              {/* Validation warnings */}
              {rule.days.length === 0 && (
                <p className="text-xs text-amber-400 flex items-center gap-1">
                  <AlertCircle size={12} />
                  Select at least one day for this rule to work
                </p>
              )}
              {rule.startTime === rule.endTime && (
                <p className="text-xs text-amber-400 flex items-center gap-1">
                  <AlertCircle size={12} />
                  Same start and end time - rule will be skipped
                </p>
              )}

              {/* Destination URL */}
              <input
                type="text"
                value={rule.destination}
                onChange={(e) => updateRule(index, 'destination', e.target.value)}
                placeholder="https://example.com/business-hours"
                className={`w-full bg-gray-800/50 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors ${
                  rule.destination && isValidUrl(rule.destination)
                    ? 'border-green-500/50'
                    : rule.destination && !isValidUrl(rule.destination)
                      ? 'border-red-500/50'
                      : 'border-gray-700 focus:border-violet-500'
                }`}
              />
            </div>
          ))}

          {/* Add rule button */}
          <button
            type="button"
            onClick={addRule}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-700 rounded-lg text-gray-400 hover:text-violet-400 hover:border-violet-500/50 transition-colors"
          >
            <Plus size={16} />
            <span className="text-sm">Add Schedule Rule</span>
          </button>

          {/* Info note */}
          {timeRedirects.rules.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
              <Info size={14} className="shrink-0 mt-0.5 text-gray-500" />
              <span>
                Rules are checked in order. First matching rule wins. If no rules match, visitors go to your main Destination URL.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(TimeRoutingSection);
