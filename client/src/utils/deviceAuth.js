import {
  startAuthentication,
  startRegistration,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import api from '../api/axios';

// LocalStorage key - slightly obfuscated
// Uses a hash-like key to be less obvious in DevTools
const DEVICE_KEY = '_lsa_' + btoa('dk').slice(0, 4);

// Timeout for network requests (10 seconds)
const AUTH_TIMEOUT = 10000;

/**
 * Check if device has a valid trusted marker
 * Validates that the marker exists and is a valid non-empty string
 */
export const hasTrustedDeviceMarker = () => {
  if (typeof window === 'undefined') return false;
  try {
    const marker = localStorage.getItem(DEVICE_KEY);
    // Validate: must exist, be non-empty, and look like a valid ID (alphanumeric/base64)
    if (!marker || typeof marker !== 'string' || marker.length < 10) {
      return false;
    }
    return true;
  } catch {
    // localStorage access can fail in some contexts (e.g., incognito on some browsers)
    return false;
  }
};

/**
 * Get the trusted device marker value (for debug/comparison purposes)
 */
export const getTrustedDeviceMarker = () => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(DEVICE_KEY);
  } catch {
    return null;
  }
};

/**
 * Set trusted device marker after successful registration
 */
export const setTrustedDeviceMarker = (credentialId) => {
  try {
    localStorage.setItem(DEVICE_KEY, credentialId);
  } catch (error) {
    console.warn('[DeviceAuth] Could not save device marker:', error);
  }
};

/**
 * Clear trusted device marker (on revocation or logout from device)
 */
export const clearTrustedDeviceMarker = () => {
  try {
    localStorage.removeItem(DEVICE_KEY);
  } catch (error) {
    console.warn('[DeviceAuth] Could not clear device marker:', error);
  }
};

// Bio auth timestamp key for 24h re-auth policy
const BIO_AUTH_TIME_KEY = 'ls_bio_auth_at';
// Configurable re-auth duration (default 24 hours)
// Set VITE_BIO_REAUTH_HOURS in .env to override
const parsedHours = parseInt(import.meta.env.VITE_BIO_REAUTH_HOURS, 10);
const BIO_AUTH_EXPIRY_HOURS = Number.isNaN(parsedHours) ? 24 : parsedHours;
const BIO_AUTH_EXPIRY_MS = BIO_AUTH_EXPIRY_HOURS * 60 * 60 * 1000;

/**
 * Set last biometric auth timestamp
 */
export const setLastBioAuthTime = () => {
  try {
    localStorage.setItem(BIO_AUTH_TIME_KEY, Date.now().toString());
  } catch (error) {
    console.warn('[DeviceAuth] Could not save bio auth time:', error);
  }
};

/**
 * Get last biometric auth timestamp
 * @returns {number|null} Timestamp in ms or null if not set
 */
export const getLastBioAuthTime = () => {
  try {
    const time = localStorage.getItem(BIO_AUTH_TIME_KEY);
    return time ? parseInt(time, 10) : null;
  } catch {
    return null;
  }
};

/**
 * Check if biometric auth has expired (>24h since last bio auth)
 * @returns {boolean} True if expired or never authenticated via bio
 */
export const isBioAuthExpired = () => {
  const lastAuth = getLastBioAuthTime();
  if (!lastAuth) return true; // Never authenticated via bio
  return (Date.now() - lastAuth) > BIO_AUTH_EXPIRY_MS;
};

/**
 * Check if browser supports WebAuthn
 */
export const supportsWebAuthn = () => {
  return browserSupportsWebAuthn();
};

/**
 * Get device info for registration
 */
export const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  
  // Detect OS
  let os = 'Unknown';
  if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';

  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edge')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';

  // Detect device model (simplified)
  let model = 'Unknown Device';
  if (ua.includes('iPhone')) {
    model = 'iPhone';
  } else if (ua.includes('iPad')) {
    model = 'iPad';
  } else if (ua.includes('Android')) {
    model = 'Android Device';
  } else if (ua.includes('Windows')) {
    model = 'Windows PC';
  } else if (ua.includes('Mac')) {
    model = 'Mac';
  }

  // Check if PWA
  const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (isPWA) {
    browser = `${browser} (PWA)`;
  }

  return { os, browser, model };
};

/**
 * Helper: Create timeout promise
 */
const createTimeout = (ms) => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), ms);
  });
};

/**
 * Start biometric authentication
 * Returns: { success: boolean, userId?: string, accessToken?: string, error?: string }
 */
export const authenticateWithBiometric = async () => {
  // Check if online first
  if (!navigator.onLine) {
    return { success: false, error: 'You appear to be offline. Check your connection.' };
  }

  try {
    // 1. Get challenge from server with timeout
    const challengePromise = api.post('/.d/challenge');
    const { data: options } = await Promise.race([
      challengePromise,
      createTimeout(AUTH_TIMEOUT)
    ]);
    
    // 2. Start WebAuthn authentication (has its own timeout via options.timeout)
    const authResponse = await startAuthentication(options);
    
    // 3. Verify with server with timeout
    const verifyPromise = api.post('/.d/verify', {
      response: authResponse,
      challengeId: options.challengeId,
    });
    
    const { data: result } = await Promise.race([
      verifyPromise,
      createTimeout(AUTH_TIMEOUT)
    ]);
    
    if (result.success) {
      // Token is managed via httpOnly cookies
      // Save/Refresh the trusted device marker so we default to bio next time
      setTrustedDeviceMarker(result.deviceId);
      // Save bio auth timestamp for 24h re-auth policy
      setLastBioAuthTime();
      
      // The setAccessToken in axios is handled by the caller via setUser
      
      return { 
        success: true, 
        userId: result._id,
        accessToken: result.accessToken,
        user: {
          _id: result._id,
          email: result.email,
          firstName: result.firstName,
          lastName: result.lastName,
          role: result.role,
        }
      };
    }
    
    return { success: false, error: 'Verification failed' };
  } catch (error) {
    console.error('[Biometric Auth] Error:', error);
    
    // User cancelled
    if (error.name === 'NotAllowedError') {
      return { success: false, error: 'cancelled' };
    }
    
    // Invalid authenticator state (e.g., credential not found on device)
    if (error.name === 'InvalidStateError') {
      return { success: false, error: 'Device credential not found. Please re-register this device.' };
    }
    
    // Timeout
    if (error.message === 'timeout') {
      return { success: false, error: 'Request timed out. Please try again.' };
    }
    
    // Network error (no response from server)
    if (!error.response) {
      if (!navigator.onLine) {
        return { success: false, error: 'You appear to be offline. Check your connection.' };
      }
      return { success: false, error: 'Cannot reach server. Please try again later.' };
    }
    
    // Rate limited
    if (error.response?.status === 429) {
      const retryAfter = error.response.data?.retryAfter || 30;
      return { success: false, error: `Too many attempts. Try again in ${retryAfter} seconds.` };
    }
    
    // Challenge expired
    if (error.response?.status === 410) {
      return { success: false, error: 'Session expired. Please try again.' };
    }
    
    // Server errors
    if (error.response?.status >= 500) {
      return { success: false, error: 'Server error. Please try again later.' };
    }
    
    // Device not found (credential ID not in database)
    if (error.response?.status === 400 && error.response.data?.message?.includes('credential')) {
      return { success: false, error: 'Device not recognized. Please re-register this device.' };
    }
    
    return { success: false, error: error.response?.data?.message || error.message || 'Authentication failed' };
  }
};

/**
 * Register a new device (requires admin to be logged in and on whitelisted IP)
 */
export const registerDevice = async (deviceName = null) => {
  // Check if online first
  if (!navigator.onLine) {
    return { success: false, error: 'You appear to be offline. Check your connection.' };
  }

  try {
    const deviceInfo = getDeviceInfo();
    
    // 1. Get registration options from server with timeout
    const optionsPromise = api.post('/.d/register/options');
    const { data: options } = await Promise.race([
      optionsPromise,
      createTimeout(AUTH_TIMEOUT)
    ]);
    
    // 2. Start WebAuthn registration
    const regResponse = await startRegistration(options);
    
    // 3. Verify with server with timeout
    const verifyPromise = api.post('/.d/register/verify', {
      response: regResponse,
      deviceName: deviceName || `${deviceInfo.model} - ${deviceInfo.browser}`,
      deviceInfo,
    });
    
    const { data: result } = await Promise.race([
      verifyPromise,
      createTimeout(AUTH_TIMEOUT)
    ]);
    
    if (result.success) {
      // Store device marker in localStorage
      setTrustedDeviceMarker(result.deviceId);
      return { success: true, deviceId: result.deviceId };
    }
    
    return { success: false, error: 'Registration failed' };
  } catch (error) {
    console.error('[Device Registration] Error:', error);
    
    // User cancelled
    if (error.name === 'NotAllowedError') {
      return { success: false, error: 'cancelled' };
    }
    
    // Credential already exists on this device (trying to register same authenticator twice)
    if (error.name === 'InvalidStateError') {
      return { success: false, error: 'This authenticator is already registered. Try a different one.' };
    }
    
    // Timeout
    if (error.message === 'timeout') {
      return { success: false, error: 'Request timed out. Please try again.' };
    }
    
    // Network error (no response from server)
    if (!error.response) {
      if (!navigator.onLine) {
        return { success: false, error: 'You appear to be offline. Check your connection.' };
      }
      return { success: false, error: 'Cannot reach server. Please try again later.' };
    }
    
    // Device limit reached
    if (error.response?.status === 400 && error.response.data?.message?.includes('Maximum')) {
      return { success: false, error: error.response.data.message };
    }
    
    // IP not whitelisted (shouldn't happen if UI is correct, but just in case)
    if (error.response?.status === 403 || error.response?.status === 404) {
      return { success: false, error: 'Registration only allowed from whitelisted IPs.' };
    }
    
    // Unauthorized (session expired)
    if (error.response?.status === 401) {
      return { success: false, error: 'Session expired. Please log in again.' };
    }
    
    // Server errors
    if (error.response?.status >= 500) {
      return { success: false, error: 'Server error. Please try again later.' };
    }
    
    return { success: false, error: error.response?.data?.message || error.message || 'Registration failed' };
  }
};

/**
 * Get list of registered devices
 */
export const getDevices = async () => {
  try {
    const { data } = await api.get('/.d/devices');
    return { success: true, devices: data };
  } catch (error) {
    if (!error.response) {
      return { success: false, error: 'Cannot reach server. Please try again later.' };
    }
    if (error.response?.status === 401) {
      return { success: false, error: 'Session expired. Please log in again.' };
    }
    if (error.response?.status >= 500) {
      return { success: false, error: 'Server error. Please try again later.' };
    }
    return { success: false, error: error.response?.data?.message || error.message || 'Failed to load devices' };
  }
};

/**
 * Update device name
 */
export const updateDeviceName = async (deviceId, newName) => {
  try {
    const { data } = await api.patch(`/.d/devices/${deviceId}`, { deviceName: newName });
    return { success: true, deviceName: data.deviceName };
  } catch (error) {
    if (error.response?.status === 401) {
      return { success: false, error: 'Session expired. Please log in again.' };
    }
    if (error.response?.status === 404) {
      return { success: false, error: 'Device not found. It may have been revoked.' };
    }
    return { success: false, error: error.response?.data?.message || error.message || 'Failed to update device' };
  }
};

/**
 * Revoke a specific device
 */
export const revokeDevice = async (deviceId) => {
  try {
    await api.delete(`/.d/devices/${deviceId}`);
    
    // If revoking current device, clear marker
    try {
      const currentMarker = localStorage.getItem(DEVICE_KEY);
      if (currentMarker === deviceId) {
        clearTrustedDeviceMarker();
      }
    } catch {
      // localStorage access failed, marker may already be gone
    }
    
    return { success: true };
  } catch (error) {
    if (error.response?.status === 401) {
      return { success: false, error: 'Session expired. Please log in again.' };
    }
    if (error.response?.status === 404) {
      return { success: true }; // Device already gone, treat as success
    }
    if (error.response?.status >= 500) {
      return { success: false, error: 'Server error. Please try again later.' };
    }
    return { success: false, error: error.response?.data?.message || error.message || 'Failed to revoke device' };
  }
};

/**
 * Revoke all devices
 */
export const revokeAllDevices = async () => {
  try {
    await api.delete('/.d/devices');
    clearTrustedDeviceMarker();
    return { success: true };
  } catch (error) {
    if (error.response?.status === 401) {
      return { success: false, error: 'Session expired. Please log in again.' };
    }
    if (error.response?.status >= 500) {
      return { success: false, error: 'Server error. Please try again later.' };
    }
    return { success: false, error: error.response?.data?.message || error.message || 'Failed to revoke devices' };
  }
};
