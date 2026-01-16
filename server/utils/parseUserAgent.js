import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const UAParser = require('ua-parser-js');

/**
 * Parse a User-Agent string and extract device information
 * @param {string} userAgentString - Raw User-Agent header
 * @returns {Object} Parsed device information
 */
export const parseUserAgent = (userAgentString) => {
  if (!userAgentString) {
    return {
      browser: 'Unknown',
      browserVersion: '',
      os: 'Unknown',
      osVersion: '',
      device: 'Unknown',
      isMobile: false
    };
  }

  try {
    // Truncate excessively long UA strings to prevent ReDoS or performance issues
    const safeUA = userAgentString.length > 500 ? userAgentString.substring(0, 500) : userAgentString;
    const parser = new UAParser(safeUA);
    const result = parser.getResult();

    const browser = result.browser.name || 'Unknown';
    const browserVersion = result.browser.version 
      ? result.browser.version.split('.')[0] // Major version only
      : '';
    
    let os = result.os.name || 'Unknown';
    let osVersion = result.os.version || '';
    
    // Windows 10 and 11 report as "Windows 10" - hide version for modern Windows
    // Only show version for older Windows (7, 8, 8.1, XP, Vista)
    if (os === 'Windows') {
      const majorVersion = parseInt(osVersion.split('.')[0], 10);
      if (majorVersion >= 10 || osVersion === '10') {
        osVersion = ''; // Hide version for Windows 10+ (indistinguishable)
      }
    }
    
    // iOS User-Agent doesn't always reflect actual version (e.g., iOS 26 reports as 18.x)
    // Hide version for iOS 15+ to avoid confusion
    if (os === 'iOS') {
      const majorVersion = parseInt(osVersion.split('.')[0], 10);
      if (majorVersion >= 15) {
        osVersion = ''; // Hide version for modern iOS (UA doesn't reflect actual version)
      }
    }
    
    // macOS User-Agent can also be unreliable for newer versions
    if (os === 'Mac OS' || os === 'macOS') {
      const majorVersion = parseInt(osVersion.split('.')[0], 10);
      if (majorVersion >= 12) {
        osVersion = ''; // Hide version for macOS Monterey+
      }
    }
    
    // Determine device type
    let device = 'Desktop';
    const deviceType = result.device.type;
    const deviceModel = result.device.model || '';
    const deviceVendor = result.device.vendor || '';
    
    if (deviceType === 'mobile') {
      device = 'Mobile';
    } else if (deviceType === 'tablet') {
      device = 'Tablet';
    } else if (!deviceType && result.device.model) {
      // Some mobile devices don't have type but have model
      device = 'Mobile';
    }

    const isMobile = device === 'Mobile' || device === 'Tablet';

    // Get CPU architecture if available (only for desktops)
    let cpuArch = '';
    if (!isMobile && result.cpu?.architecture) {
      // Map technical names to user-friendly names
      const archMap = {
        'amd64': 'x64',
        'ia64': 'Itanium',
        'arm': 'ARM',
        'arm64': 'ARM64',
        'ia32': 'x86'
      };
      cpuArch = archMap[result.cpu.architecture] || result.cpu.architecture;
    }

    return {
      browser,
      browserVersion,
      os,
      osVersion,
      device,
      deviceModel,
      deviceVendor,
      cpuArch,
      isMobile
    };
  } catch (error) {
    console.error('Error parsing User-Agent:', error);
    return {
      browser: 'Unknown',
      browserVersion: '',
      os: 'Unknown',
      osVersion: '',
      device: 'Unknown',
      deviceModel: '',
      deviceVendor: '',
      cpuArch: '',
      isMobile: false
    };
  }
};

/**
 * Get a human-readable browser name with version
 * @param {Object} deviceInfo - Parsed device info
 * @returns {string} e.g., "Chrome 120"
 */
export const getBrowserDisplayName = (deviceInfo) => {
  if (!deviceInfo.browser || deviceInfo.browser === 'Unknown') {
    return 'Unknown Browser';
  }
  
  if (deviceInfo.browserVersion) {
    return `${deviceInfo.browser} ${deviceInfo.browserVersion}`;
  }
  
  return deviceInfo.browser;
};

/**
 * Get a human-readable OS name with version
 * @param {Object} deviceInfo - Parsed device info
 * @returns {string} e.g., "Windows 11"
 */
export const getOSDisplayName = (deviceInfo) => {
  if (!deviceInfo.os || deviceInfo.os === 'Unknown') {
    return 'Unknown OS';
  }
  
  if (deviceInfo.osVersion) {
    return `${deviceInfo.os} ${deviceInfo.osVersion}`;
  }
  
  return deviceInfo.os;
};

export default parseUserAgent;
