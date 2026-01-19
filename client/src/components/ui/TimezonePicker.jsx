import { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Globe, Check, ChevronDown, Clock, Search, X } from 'lucide-react';

// Comprehensive IANA timezones grouped by region
const TIMEZONE_GROUPS = [
  {
    label: 'Americas',
    timezones: [
      { value: 'America/New_York', city: 'New York', abbr: 'EST/EDT' },
      { value: 'America/Chicago', city: 'Chicago', abbr: 'CST/CDT' },
      { value: 'America/Denver', city: 'Denver', abbr: 'MST/MDT' },
      { value: 'America/Phoenix', city: 'Phoenix', abbr: 'MST' },
      { value: 'America/Los_Angeles', city: 'Los Angeles', abbr: 'PST/PDT' },
      { value: 'America/Anchorage', city: 'Anchorage', abbr: 'AKST' },
      { value: 'Pacific/Honolulu', city: 'Honolulu', abbr: 'HST' },
      { value: 'America/Toronto', city: 'Toronto', abbr: 'EST/EDT' },
      { value: 'America/Vancouver', city: 'Vancouver', abbr: 'PST/PDT' },
      { value: 'America/Mexico_City', city: 'Mexico City', abbr: 'CST' },
      { value: 'America/Bogota', city: 'Bogotá', abbr: 'COT' },
      { value: 'America/Lima', city: 'Lima', abbr: 'PET' },
      { value: 'America/Santiago', city: 'Santiago', abbr: 'CLT' },
      { value: 'America/Sao_Paulo', city: 'São Paulo', abbr: 'BRT' },
      { value: 'America/Buenos_Aires', city: 'Buenos Aires', abbr: 'ART' },
    ]
  },
  {
    label: 'Europe',
    timezones: [
      { value: 'Europe/London', city: 'London', abbr: 'GMT/BST' },
      { value: 'Europe/Dublin', city: 'Dublin', abbr: 'GMT/IST' },
      { value: 'Europe/Paris', city: 'Paris', abbr: 'CET/CEST' },
      { value: 'Europe/Berlin', city: 'Berlin', abbr: 'CET/CEST' },
      { value: 'Europe/Amsterdam', city: 'Amsterdam', abbr: 'CET/CEST' },
      { value: 'Europe/Brussels', city: 'Brussels', abbr: 'CET/CEST' },
      { value: 'Europe/Madrid', city: 'Madrid', abbr: 'CET/CEST' },
      { value: 'Europe/Rome', city: 'Rome', abbr: 'CET/CEST' },
      { value: 'Europe/Zurich', city: 'Zurich', abbr: 'CET/CEST' },
      { value: 'Europe/Vienna', city: 'Vienna', abbr: 'CET/CEST' },
      { value: 'Europe/Stockholm', city: 'Stockholm', abbr: 'CET/CEST' },
      { value: 'Europe/Warsaw', city: 'Warsaw', abbr: 'CET/CEST' },
      { value: 'Europe/Prague', city: 'Prague', abbr: 'CET/CEST' },
      { value: 'Europe/Athens', city: 'Athens', abbr: 'EET/EEST' },
      { value: 'Europe/Helsinki', city: 'Helsinki', abbr: 'EET/EEST' },
      { value: 'Europe/Moscow', city: 'Moscow', abbr: 'MSK' },
      { value: 'Europe/Istanbul', city: 'Istanbul', abbr: 'TRT' },
    ]
  },
  {
    label: 'Asia',
    timezones: [
      { value: 'Asia/Dubai', city: 'Dubai', abbr: 'GST' },
      { value: 'Asia/Riyadh', city: 'Riyadh', abbr: 'AST' },
      { value: 'Asia/Tehran', city: 'Tehran', abbr: 'IRST' },
      { value: 'Asia/Karachi', city: 'Karachi', abbr: 'PKT' },
      { value: 'Asia/Kolkata', city: 'India', abbr: 'IST' },
      { value: 'Asia/Colombo', city: 'Colombo', abbr: 'IST' },
      { value: 'Asia/Dhaka', city: 'Dhaka', abbr: 'BST' },
      { value: 'Asia/Bangkok', city: 'Bangkok', abbr: 'ICT' },
      { value: 'Asia/Ho_Chi_Minh', city: 'Ho Chi Minh', abbr: 'ICT' },
      { value: 'Asia/Jakarta', city: 'Jakarta', abbr: 'WIB' },
      { value: 'Asia/Singapore', city: 'Singapore', abbr: 'SGT' },
      { value: 'Asia/Kuala_Lumpur', city: 'Kuala Lumpur', abbr: 'MYT' },
      { value: 'Asia/Hong_Kong', city: 'Hong Kong', abbr: 'HKT' },
      { value: 'Asia/Shanghai', city: 'Shanghai', abbr: 'CST' },
      { value: 'Asia/Taipei', city: 'Taipei', abbr: 'CST' },
      { value: 'Asia/Manila', city: 'Manila', abbr: 'PHT' },
      { value: 'Asia/Seoul', city: 'Seoul', abbr: 'KST' },
      { value: 'Asia/Tokyo', city: 'Tokyo', abbr: 'JST' },
    ]
  },
  {
    label: 'Pacific & Oceania',
    timezones: [
      { value: 'Australia/Perth', city: 'Perth', abbr: 'AWST' },
      { value: 'Australia/Adelaide', city: 'Adelaide', abbr: 'ACST' },
      { value: 'Australia/Sydney', city: 'Sydney', abbr: 'AEST/AEDT' },
      { value: 'Australia/Melbourne', city: 'Melbourne', abbr: 'AEST/AEDT' },
      { value: 'Australia/Brisbane', city: 'Brisbane', abbr: 'AEST' },
      { value: 'Pacific/Auckland', city: 'Auckland', abbr: 'NZST' },
      { value: 'Pacific/Fiji', city: 'Fiji', abbr: 'FJT' },
      { value: 'Pacific/Guam', city: 'Guam', abbr: 'ChST' },
    ]
  },
  {
    label: 'Africa & Middle East',
    timezones: [
      { value: 'Africa/Cairo', city: 'Cairo', abbr: 'EET' },
      { value: 'Africa/Johannesburg', city: 'Johannesburg', abbr: 'SAST' },
      { value: 'Africa/Lagos', city: 'Lagos', abbr: 'WAT' },
      { value: 'Africa/Nairobi', city: 'Nairobi', abbr: 'EAT' },
      { value: 'Africa/Casablanca', city: 'Casablanca', abbr: 'WET' },
      { value: 'Asia/Jerusalem', city: 'Jerusalem', abbr: 'IST' },
    ]
  },
  {
    label: 'Other',
    timezones: [
      { value: 'UTC', city: 'UTC', abbr: 'Coordinated Universal Time' },
    ]
  }
];

// Get current date and time in a timezone
const getDateTimeInZone = (timezone) => {
  try {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const date = now.toLocaleDateString('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    return { time, date };
  } catch {
    return { time: '--:--', date: '---' };
  }
};

// Get user's detected timezone
const getDetectedTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

// Check if timezone exists in our list
const findTimezone = (value) => {
  for (const group of TIMEZONE_GROUPS) {
    const found = group.timezones.find(tz => tz.value === value);
    if (found) return { ...found, group: group.label };
  }
  return null;
};



const TimezonePicker = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [, forceUpdate] = useState(0); // Force re-render for live time
  const searchInputRef = useRef(null);
  const detectedTimezone = useMemo(() => getDetectedTimezone(), []);

  // Live time update while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Focus search on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      // Delay to ensure modal is mounted
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Filter timezones based on search
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return TIMEZONE_GROUPS;
    
    const term = search.toLowerCase();
    return TIMEZONE_GROUPS.map(group => ({
      ...group,
      timezones: group.timezones.filter(tz => 
        tz.city.toLowerCase().includes(term) ||
        tz.abbr.toLowerCase().includes(term) ||
        tz.value.toLowerCase().includes(term)
      )
    })).filter(group => group.timezones.length > 0);
  }, [search]);

  // Get display info for current value
  const currentTz = findTimezone(value);
  const displayCity = currentTz?.city || value.split('/').pop()?.replace(/_/g, ' ') || value;
  const displayAbbr = currentTz?.abbr || '';
  const isDetected = value === detectedTimezone;
  const currentDateTime = getDateTimeInZone(value);

  const handleSelect = useCallback((timezone) => {
    onChange(timezone);
    setIsOpen(false);
    setSearch('');
  }, [onChange]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearch('');
  }, []);

  // Dropdown content (shared between desktop popover and mobile modal)
  const dropdownContent = (
    <>
      {/* Header with Search */}
      <div className="p-3 border-b border-gray-700/50 bg-gray-900 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Select Timezone</h3>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors sm:hidden"
          >
            <X size={18} />
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search city or timezone..."
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-9 pr-8 py-2.5 text-sm text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Use My Timezone */}
      <div className="p-2 border-b border-gray-700/50">
        <button
          type="button"
          onClick={() => handleSelect(detectedTimezone)}
          className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all ${
            isDetected
              ? 'bg-violet-500/15 border border-violet-500/30'
              : 'hover:bg-gray-800 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <Clock size={16} className="text-violet-400" />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-white">Use My Timezone</div>
              <div className="text-xs text-gray-400">
                {detectedTimezone.split('/').pop()?.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono text-violet-300">{getDateTimeInZone(detectedTimezone).time}</div>
            <div className="text-xs text-gray-500">{getDateTimeInZone(detectedTimezone).date}</div>
          </div>
        </button>
      </div>

      {/* Timezone List */}
      <div className="overflow-y-auto overscroll-contain flex-1" style={{ maxHeight: 'calc(100% - 180px)' }}>
        {filteredGroups.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            No timezones found for "{search}"
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-800/30 sticky top-0">
                {group.label}
              </div>
              {group.timezones.map((tz) => {
                const isSelected = value === tz.value;
                const tzDateTime = getDateTimeInZone(tz.value);
                return (
                  <button
                    key={tz.value}
                    type="button"
                    onClick={() => handleSelect(tz.value)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-violet-500/10 text-white'
                        : 'text-gray-300 hover:bg-gray-800/70 active:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-violet-400' : 'bg-gray-600'}`} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{tz.city}</div>
                        <div className="text-xs text-gray-500">{tz.abbr}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-mono text-gray-300">{tzDateTime.time}</div>
                        <div className="text-[10px] text-gray-500">{tzDateTime.date}</div>
                      </div>
                      {isSelected && <Check size={16} className="text-violet-400" />}
                    </div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </>
  );

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-3 rounded-xl border transition-all ${
          isOpen
            ? 'border-violet-500 bg-violet-500/10 ring-2 ring-violet-500/20'
            : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-violet-500/20 rounded-lg shrink-0">
            <Globe size={16} className="text-violet-400" />
          </div>
          <div className="text-left min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white truncate">{displayCity}</span>
              {isDetected && (
                <span className="text-[10px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full shrink-0">
                  Your TZ
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{displayAbbr}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-sm font-mono text-violet-300">{currentDateTime.time}</div>
            <div className="text-xs text-gray-500">{currentDateTime.date}</div>
          </div>
          <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Modal - Portal to body */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          
          {/* Modal Content */}
          <div 
            className="relative z-10 bg-gray-900 border border-gray-700 shadow-2xl overflow-hidden flex flex-col
              w-full max-h-[85dvh] rounded-t-2xl
              sm:w-[420px] sm:max-w-[90vw] sm:max-h-[500px] sm:rounded-2xl sm:m-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile handle */}
            <div className="sm:hidden w-12 h-1 bg-gray-600 rounded-full mx-auto mt-2 mb-1" />
            
            {dropdownContent}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default memo(TimezonePicker);
