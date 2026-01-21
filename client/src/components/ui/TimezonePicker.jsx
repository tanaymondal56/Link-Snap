import { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Globe, Check, ChevronDown, Clock, Search, X } from 'lucide-react';

// Comprehensive IANA timezones with search keywords (country, cities, aliases)
const TIMEZONE_GROUPS = [
  {
    label: 'North America',
    timezones: [
      { value: 'America/New_York', city: 'New York', abbr: 'EST/EDT', keywords: 'usa united states eastern boston miami florida' },
      { value: 'America/Detroit', city: 'Detroit', abbr: 'EST/EDT', keywords: 'usa united states michigan' },
      { value: 'America/Toronto', city: 'Toronto', abbr: 'EST/EDT', keywords: 'canada ontario montreal quebec' },
      { value: 'America/Chicago', city: 'Chicago', abbr: 'CST/CDT', keywords: 'usa united states central texas houston dallas' },
      { value: 'America/Denver', city: 'Denver', abbr: 'MST/MDT', keywords: 'usa united states mountain colorado' },
      { value: 'America/Phoenix', city: 'Phoenix', abbr: 'MST', keywords: 'usa united states arizona' },
      { value: 'America/Los_Angeles', city: 'Los Angeles', abbr: 'PST/PDT', keywords: 'usa united states pacific california san francisco seattle washington' },
      { value: 'America/Vancouver', city: 'Vancouver', abbr: 'PST/PDT', keywords: 'canada british columbia bc' },
      { value: 'America/Anchorage', city: 'Anchorage', abbr: 'AKST/AKDT', keywords: 'usa united states alaska' },
      { value: 'Pacific/Honolulu', city: 'Honolulu', abbr: 'HST', keywords: 'usa united states hawaii' },
      { value: 'America/Halifax', city: 'Halifax', abbr: 'AST/ADT', keywords: 'canada nova scotia atlantic' },
      { value: 'America/St_Johns', city: 'St. Johns', abbr: 'NST/NDT', keywords: 'canada newfoundland' },
      { value: 'America/Winnipeg', city: 'Winnipeg', abbr: 'CST/CDT', keywords: 'canada manitoba' },
      { value: 'America/Edmonton', city: 'Edmonton', abbr: 'MST/MDT', keywords: 'canada alberta calgary' },
      { value: 'America/Regina', city: 'Regina', abbr: 'CST', keywords: 'canada saskatchewan' },
    ]
  },
  {
    label: 'Latin America',
    timezones: [
      { value: 'America/Mexico_City', city: 'Mexico City', abbr: 'CST/CDT', keywords: 'mexico cdmx' },
      { value: 'America/Tijuana', city: 'Tijuana', abbr: 'PST/PDT', keywords: 'mexico baja' },
      { value: 'America/Cancun', city: 'Cancun', abbr: 'EST', keywords: 'mexico quintana roo' },
      { value: 'America/Guatemala', city: 'Guatemala City', abbr: 'CST', keywords: 'guatemala' },
      { value: 'America/Havana', city: 'Havana', abbr: 'CST/CDT', keywords: 'cuba' },
      { value: 'America/Panama', city: 'Panama City', abbr: 'EST', keywords: 'panama' },
      { value: 'America/Bogota', city: 'Bogotá', abbr: 'COT', keywords: 'colombia medellin cali' },
      { value: 'America/Lima', city: 'Lima', abbr: 'PET', keywords: 'peru' },
      { value: 'America/Caracas', city: 'Caracas', abbr: 'VET', keywords: 'venezuela' },
      { value: 'America/La_Paz', city: 'La Paz', abbr: 'BOT', keywords: 'bolivia' },
      { value: 'America/Santiago', city: 'Santiago', abbr: 'CLT/CLST', keywords: 'chile' },
      { value: 'America/Sao_Paulo', city: 'São Paulo', abbr: 'BRT', keywords: 'brazil brasil rio de janeiro' },
      { value: 'America/Buenos_Aires', city: 'Buenos Aires', abbr: 'ART', keywords: 'argentina' },
      { value: 'America/Montevideo', city: 'Montevideo', abbr: 'UYT', keywords: 'uruguay' },
      { value: 'America/Asuncion', city: 'Asunción', abbr: 'PYT/PYST', keywords: 'paraguay' },
    ]
  },
  {
    label: 'Western Europe',
    timezones: [
      { value: 'Europe/London', city: 'London', abbr: 'GMT/BST', keywords: 'uk united kingdom england britain manchester' },
      { value: 'Europe/Dublin', city: 'Dublin', abbr: 'GMT/IST', keywords: 'ireland eire' },
      { value: 'Atlantic/Reykjavik', city: 'Reykjavik', abbr: 'GMT', keywords: 'iceland' },
      { value: 'Europe/Lisbon', city: 'Lisbon', abbr: 'WET/WEST', keywords: 'portugal porto' },
      { value: 'Europe/Paris', city: 'Paris', abbr: 'CET/CEST', keywords: 'france lyon marseille' },
      { value: 'Europe/Brussels', city: 'Brussels', abbr: 'CET/CEST', keywords: 'belgium' },
      { value: 'Europe/Amsterdam', city: 'Amsterdam', abbr: 'CET/CEST', keywords: 'netherlands holland dutch rotterdam' },
      { value: 'Europe/Luxembourg', city: 'Luxembourg', abbr: 'CET/CEST', keywords: 'luxembourg' },
    ]
  },
  {
    label: 'Central Europe',
    timezones: [
      { value: 'Europe/Berlin', city: 'Berlin', abbr: 'CET/CEST', keywords: 'germany deutschland munich frankfurt hamburg' },
      { value: 'Europe/Zurich', city: 'Zurich', abbr: 'CET/CEST', keywords: 'switzerland swiss geneva basel' },
      { value: 'Europe/Vienna', city: 'Vienna', abbr: 'CET/CEST', keywords: 'austria' },
      { value: 'Europe/Prague', city: 'Prague', abbr: 'CET/CEST', keywords: 'czech republic czechia' },
      { value: 'Europe/Warsaw', city: 'Warsaw', abbr: 'CET/CEST', keywords: 'poland krakow' },
      { value: 'Europe/Budapest', city: 'Budapest', abbr: 'CET/CEST', keywords: 'hungary' },
      { value: 'Europe/Copenhagen', city: 'Copenhagen', abbr: 'CET/CEST', keywords: 'denmark' },
      { value: 'Europe/Stockholm', city: 'Stockholm', abbr: 'CET/CEST', keywords: 'sweden' },
      { value: 'Europe/Oslo', city: 'Oslo', abbr: 'CET/CEST', keywords: 'norway' },
    ]
  },
  {
    label: 'Southern Europe',
    timezones: [
      { value: 'Europe/Madrid', city: 'Madrid', abbr: 'CET/CEST', keywords: 'spain barcelona valencia' },
      { value: 'Europe/Rome', city: 'Rome', abbr: 'CET/CEST', keywords: 'italy italia milan florence naples' },
      { value: 'Europe/Athens', city: 'Athens', abbr: 'EET/EEST', keywords: 'greece' },
      { value: 'Europe/Belgrade', city: 'Belgrade', abbr: 'CET/CEST', keywords: 'serbia' },
      { value: 'Europe/Zagreb', city: 'Zagreb', abbr: 'CET/CEST', keywords: 'croatia' },
      { value: 'Europe/Ljubljana', city: 'Ljubljana', abbr: 'CET/CEST', keywords: 'slovenia' },
      { value: 'Europe/Sarajevo', city: 'Sarajevo', abbr: 'CET/CEST', keywords: 'bosnia herzegovina' },
      { value: 'Europe/Malta', city: 'Malta', abbr: 'CET/CEST', keywords: 'malta' },
    ]
  },
  {
    label: 'Eastern Europe & Russia',
    timezones: [
      { value: 'Europe/Helsinki', city: 'Helsinki', abbr: 'EET/EEST', keywords: 'finland' },
      { value: 'Europe/Tallinn', city: 'Tallinn', abbr: 'EET/EEST', keywords: 'estonia' },
      { value: 'Europe/Riga', city: 'Riga', abbr: 'EET/EEST', keywords: 'latvia' },
      { value: 'Europe/Vilnius', city: 'Vilnius', abbr: 'EET/EEST', keywords: 'lithuania' },
      { value: 'Europe/Kyiv', city: 'Kyiv', abbr: 'EET/EEST', keywords: 'ukraine kiev' },
      { value: 'Europe/Bucharest', city: 'Bucharest', abbr: 'EET/EEST', keywords: 'romania' },
      { value: 'Europe/Sofia', city: 'Sofia', abbr: 'EET/EEST', keywords: 'bulgaria' },
      { value: 'Europe/Istanbul', city: 'Istanbul', abbr: 'TRT', keywords: 'turkey ankara' },
      { value: 'Europe/Moscow', city: 'Moscow', abbr: 'MSK', keywords: 'russia st petersburg' },
      { value: 'Europe/Minsk', city: 'Minsk', abbr: 'MSK', keywords: 'belarus' },
      { value: 'Europe/Samara', city: 'Samara', abbr: 'SAMT', keywords: 'russia' },
      { value: 'Asia/Yekaterinburg', city: 'Yekaterinburg', abbr: 'YEKT', keywords: 'russia ural' },
      { value: 'Asia/Novosibirsk', city: 'Novosibirsk', abbr: 'NOVT', keywords: 'russia siberia' },
      { value: 'Asia/Vladivostok', city: 'Vladivostok', abbr: 'VLAT', keywords: 'russia far east' },
      { value: 'Asia/Kamchatka', city: 'Kamchatka', abbr: 'PETT', keywords: 'russia' },
    ]
  },
  {
    label: 'Middle East',
    timezones: [
      { value: 'Asia/Jerusalem', city: 'Jerusalem', abbr: 'IST/IDT', keywords: 'israel tel aviv' },
      { value: 'Asia/Beirut', city: 'Beirut', abbr: 'EET/EEST', keywords: 'lebanon' },
      { value: 'Asia/Amman', city: 'Amman', abbr: 'AST', keywords: 'jordan' },
      { value: 'Asia/Damascus', city: 'Damascus', abbr: 'EET/EEST', keywords: 'syria' },
      { value: 'Asia/Baghdad', city: 'Baghdad', abbr: 'AST', keywords: 'iraq' },
      { value: 'Asia/Kuwait', city: 'Kuwait City', abbr: 'AST', keywords: 'kuwait' },
      { value: 'Asia/Riyadh', city: 'Riyadh', abbr: 'AST', keywords: 'saudi arabia jeddah mecca' },
      { value: 'Asia/Qatar', city: 'Doha', abbr: 'AST', keywords: 'qatar' },
      { value: 'Asia/Dubai', city: 'Dubai', abbr: 'GST', keywords: 'uae united arab emirates abu dhabi' },
      { value: 'Asia/Muscat', city: 'Muscat', abbr: 'GST', keywords: 'oman' },
      { value: 'Asia/Tehran', city: 'Tehran', abbr: 'IRST/IRDT', keywords: 'iran persia' },
      { value: 'Asia/Baku', city: 'Baku', abbr: 'AZT', keywords: 'azerbaijan' },
      { value: 'Asia/Tbilisi', city: 'Tbilisi', abbr: 'GET', keywords: 'georgia' },
      { value: 'Asia/Yerevan', city: 'Yerevan', abbr: 'AMT', keywords: 'armenia' },
    ]
  },
  {
    label: 'South Asia',
    timezones: [
      { value: 'Asia/Karachi', city: 'Karachi', abbr: 'PKT', keywords: 'pakistan lahore islamabad' },
      { value: 'Asia/Kolkata', city: 'Mumbai', abbr: 'IST', keywords: 'india delhi chennai bangalore kolkata hyderabad' },
      { value: 'Asia/Colombo', city: 'Colombo', abbr: 'IST', keywords: 'sri lanka ceylon' },
      { value: 'Asia/Kathmandu', city: 'Kathmandu', abbr: 'NPT', keywords: 'nepal' },
      { value: 'Asia/Dhaka', city: 'Dhaka', abbr: 'BST', keywords: 'bangladesh' },
      { value: 'Asia/Yangon', city: 'Yangon', abbr: 'MMT', keywords: 'myanmar burma rangoon' },
    ]
  },
  {
    label: 'Southeast Asia',
    timezones: [
      { value: 'Asia/Bangkok', city: 'Bangkok', abbr: 'ICT', keywords: 'thailand' },
      { value: 'Asia/Ho_Chi_Minh', city: 'Ho Chi Minh', abbr: 'ICT', keywords: 'vietnam saigon hanoi' },
      { value: 'Asia/Phnom_Penh', city: 'Phnom Penh', abbr: 'ICT', keywords: 'cambodia' },
      { value: 'Asia/Vientiane', city: 'Vientiane', abbr: 'ICT', keywords: 'laos' },
      { value: 'Asia/Jakarta', city: 'Jakarta', abbr: 'WIB', keywords: 'indonesia bali' },
      { value: 'Asia/Makassar', city: 'Makassar', abbr: 'WITA', keywords: 'indonesia sulawesi' },
      { value: 'Asia/Jayapura', city: 'Jayapura', abbr: 'WIT', keywords: 'indonesia papua' },
      { value: 'Asia/Singapore', city: 'Singapore', abbr: 'SGT', keywords: 'singapore' },
      { value: 'Asia/Kuala_Lumpur', city: 'Kuala Lumpur', abbr: 'MYT', keywords: 'malaysia' },
      { value: 'Asia/Brunei', city: 'Brunei', abbr: 'BNT', keywords: 'brunei' },
      { value: 'Asia/Manila', city: 'Manila', abbr: 'PHT', keywords: 'philippines' },
    ]
  },
  {
    label: 'East Asia',
    timezones: [
      { value: 'Asia/Shanghai', city: 'Beijing/Shanghai', abbr: 'CST', keywords: 'china chinese shenzhen guangzhou' },
      { value: 'Asia/Hong_Kong', city: 'Hong Kong', abbr: 'HKT', keywords: 'hong kong hk' },
      { value: 'Asia/Macau', city: 'Macau', abbr: 'CST', keywords: 'macau macao' },
      { value: 'Asia/Taipei', city: 'Taipei', abbr: 'CST', keywords: 'taiwan' },
      { value: 'Asia/Seoul', city: 'Seoul', abbr: 'KST', keywords: 'south korea korean busan' },
      { value: 'Asia/Pyongyang', city: 'Pyongyang', abbr: 'KST', keywords: 'north korea' },
      { value: 'Asia/Tokyo', city: 'Tokyo', abbr: 'JST', keywords: 'japan osaka kyoto' },
      { value: 'Asia/Ulaanbaatar', city: 'Ulaanbaatar', abbr: 'ULAT', keywords: 'mongolia' },
    ]
  },
  {
    label: 'Central Asia',
    timezones: [
      { value: 'Asia/Almaty', city: 'Almaty', abbr: 'ALMT', keywords: 'kazakhstan' },
      { value: 'Asia/Ashgabat', city: 'Ashgabat', abbr: 'TMT', keywords: 'turkmenistan' },
      { value: 'Asia/Tashkent', city: 'Tashkent', abbr: 'UZT', keywords: 'uzbekistan' },
      { value: 'Asia/Dushanbe', city: 'Dushanbe', abbr: 'TJT', keywords: 'tajikistan' },
      { value: 'Asia/Bishkek', city: 'Bishkek', abbr: 'KGT', keywords: 'kyrgyzstan' },
      { value: 'Asia/Kabul', city: 'Kabul', abbr: 'AFT', keywords: 'afghanistan' },
    ]
  },
  {
    label: 'Australia',
    timezones: [
      { value: 'Australia/Perth', city: 'Perth', abbr: 'AWST', keywords: 'australia western' },
      { value: 'Australia/Darwin', city: 'Darwin', abbr: 'ACST', keywords: 'australia northern territory' },
      { value: 'Australia/Adelaide', city: 'Adelaide', abbr: 'ACST/ACDT', keywords: 'australia south' },
      { value: 'Australia/Brisbane', city: 'Brisbane', abbr: 'AEST', keywords: 'australia queensland' },
      { value: 'Australia/Sydney', city: 'Sydney', abbr: 'AEST/AEDT', keywords: 'australia new south wales nsw' },
      { value: 'Australia/Melbourne', city: 'Melbourne', abbr: 'AEST/AEDT', keywords: 'australia victoria' },
      { value: 'Australia/Hobart', city: 'Hobart', abbr: 'AEST/AEDT', keywords: 'australia tasmania' },
    ]
  },
  {
    label: 'Pacific Islands',
    timezones: [
      { value: 'Pacific/Auckland', city: 'Auckland', abbr: 'NZST/NZDT', keywords: 'new zealand wellington' },
      { value: 'Pacific/Fiji', city: 'Suva', abbr: 'FJT', keywords: 'fiji' },
      { value: 'Pacific/Tongatapu', city: 'Nukualofa', abbr: 'TOT', keywords: 'tonga' },
      { value: 'Pacific/Apia', city: 'Apia', abbr: 'WST', keywords: 'samoa' },
      { value: 'Pacific/Port_Moresby', city: 'Port Moresby', abbr: 'PGT', keywords: 'papua new guinea png' },
      { value: 'Pacific/Guam', city: 'Guam', abbr: 'ChST', keywords: 'guam usa' },
      { value: 'Pacific/Tahiti', city: 'Tahiti', abbr: 'TAHT', keywords: 'french polynesia' },
    ]
  },
  {
    label: 'Africa',
    timezones: [
      { value: 'Africa/Casablanca', city: 'Casablanca', abbr: 'WET/WEST', keywords: 'morocco rabat' },
      { value: 'Africa/Algiers', city: 'Algiers', abbr: 'CET', keywords: 'algeria' },
      { value: 'Africa/Tunis', city: 'Tunis', abbr: 'CET', keywords: 'tunisia' },
      { value: 'Africa/Tripoli', city: 'Tripoli', abbr: 'EET', keywords: 'libya' },
      { value: 'Africa/Cairo', city: 'Cairo', abbr: 'EET', keywords: 'egypt alexandria' },
      { value: 'Africa/Lagos', city: 'Lagos', abbr: 'WAT', keywords: 'nigeria abuja' },
      { value: 'Africa/Accra', city: 'Accra', abbr: 'GMT', keywords: 'ghana' },
      { value: 'Africa/Dakar', city: 'Dakar', abbr: 'GMT', keywords: 'senegal' },
      { value: 'Africa/Abidjan', city: 'Abidjan', abbr: 'GMT', keywords: 'ivory coast cote divoire' },
      { value: 'Africa/Kinshasa', city: 'Kinshasa', abbr: 'WAT', keywords: 'congo drc' },
      { value: 'Africa/Nairobi', city: 'Nairobi', abbr: 'EAT', keywords: 'kenya' },
      { value: 'Africa/Addis_Ababa', city: 'Addis Ababa', abbr: 'EAT', keywords: 'ethiopia' },
      { value: 'Africa/Kampala', city: 'Kampala', abbr: 'EAT', keywords: 'uganda' },
      { value: 'Africa/Dar_es_Salaam', city: 'Dar es Salaam', abbr: 'EAT', keywords: 'tanzania' },
      { value: 'Africa/Johannesburg', city: 'Johannesburg', abbr: 'SAST', keywords: 'south africa cape town pretoria' },
      { value: 'Africa/Harare', city: 'Harare', abbr: 'CAT', keywords: 'zimbabwe' },
      { value: 'Indian/Mauritius', city: 'Port Louis', abbr: 'MUT', keywords: 'mauritius' },
    ]
  },
  {
    label: 'Atlantic',
    timezones: [
      { value: 'Atlantic/Azores', city: 'Azores', abbr: 'AZOT/AZOST', keywords: 'portugal' },
      { value: 'Atlantic/Cape_Verde', city: 'Praia', abbr: 'CVT', keywords: 'cape verde cabo verde' },
      { value: 'Atlantic/Canary', city: 'Canary Islands', abbr: 'WET/WEST', keywords: 'spain' },
      { value: 'Atlantic/Bermuda', city: 'Hamilton', abbr: 'AST/ADT', keywords: 'bermuda' },
    ]
  },
  {
    label: 'Other',
    timezones: [
      { value: 'UTC', city: 'UTC', abbr: 'UTC', keywords: 'coordinated universal time gmt+0 gmt-0 zulu' },
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

  // Filter timezones based on search (matches: city, abbr, timezone ID, region, country, time)
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return TIMEZONE_GROUPS;
    
    const term = search.toLowerCase().trim();
    const terms = term.split(/\s+/); // Support multi-word search
    
    return TIMEZONE_GROUPS.map(group => ({
      ...group,
      timezones: group.timezones.filter(tz => {
        // Get current time for this timezone to enable time-based search
        const tzTime = getDateTimeInZone(tz.value);
        
        // Build searchable text from all fields including keywords
        const searchableText = [
          tz.city,
          tz.abbr,
          tz.value,
          tz.value.replace(/_/g, ' '), // "Los_Angeles" -> "Los Angeles"
          tz.keywords || '', // Country names and alternative cities
          group.label, // Region name
          tzTime.time, // e.g., "10:30 AM"
          tzTime.date, // e.g., "Mon, Jan 20"
        ].join(' ').toLowerCase();
        
        // All search terms must match somewhere
        return terms.every(t => searchableText.includes(t));
      })
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
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close timezone picker"
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
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-9 pr-8 py-2.5 text-base text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none"
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
      <div 
        className="flex-1 overflow-y-scroll overscroll-contain touch-pan-y"
      >
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
              w-full h-[85dvh] rounded-t-2xl
              sm:w-[420px] sm:max-w-[90vw] sm:h-auto sm:max-h-[500px] sm:rounded-2xl sm:m-4"
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
