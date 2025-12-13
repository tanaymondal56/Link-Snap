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
    const parser = new UAParser(userAgentString);
    const result = parser.getResult();

    const browser = result.browser.name || 'Unknown';
    const browserVersion = result.browser.version 
      ? result.browser.version.split('.')[0] // Major version only
      : '';
    
    const os = result.os.name || 'Unknown';
    const osVersion = result.os.version || '';
    
    // Determine device type
    let device = 'Desktop';
    const deviceType = result.device.type;
    
    if (deviceType === 'mobile') {
      device = 'Mobile';
    } else if (deviceType === 'tablet') {
      device = 'Tablet';
    } else if (!deviceType && result.device.model) {
      // Some mobile devices don't have type but have model
      device = 'Mobile';
    }

    const isMobile = device === 'Mobile' || device === 'Tablet';

    return {
      browser,
      browserVersion,
      os,
      osVersion,
      device,
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
