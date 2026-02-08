import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import TrustedDevice from '../models/TrustedDevice.js';
import User from '../models/User.js';
import { generateAccessToken } from '../utils/generateToken.js';
import { createSession } from '../utils/sessionHelper.js';
import logger from '../utils/logger.js';
import LoginHistory from '../models/LoginHistory.js';
import { getUserIP } from '../middleware/strictProxyGate.js';

// Config
const rpName = process.env.WEBAUTHN_RP_NAME || 'Link Snap Admin';
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
const origin = process.env.WEBAUTHN_ORIGIN || `https://${rpID}`;

// Challenge store - In-memory with TTL (use Redis in production for scaling)
const challengeStore = new Map();

// Rate limiting store for biometric attempts
const rateLimitStore = new Map();
const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION = 30000; // 30 seconds

// Helper: Clean up expired challenges and rate limits
const cleanup = () => {
  const now = Date.now();
  for (const [key, data] of challengeStore) {
    if (now > data.expires) {
      challengeStore.delete(key);
    }
  }
  for (const [key, data] of rateLimitStore) {
    if (now > data.lockedUntil) {
      rateLimitStore.delete(key);
    }
  }
};

// Cleanup every minute
setInterval(cleanup, 60000);

// Helper: Get client IP - uses proxy-aware extraction
const getClientIP = (req) => {
  return getUserIP(req);
};

// Helper: Cookie settings (matches authController.js)
// Set COOKIE_SAMESITE=lax in .env if using temporary tunnels
const getCookieSameSite = () => {
  if (process.env.COOKIE_SAMESITE) {
    return process.env.COOKIE_SAMESITE;
  }
  return process.env.NODE_ENV === 'production' ? 'strict' : 'lax';
};

// Helper: Check rate limit
const checkRateLimit = (identifier) => {
  const record = rateLimitStore.get(identifier);
  if (!record) return { allowed: true };
  
  if (Date.now() < record.lockedUntil) {
    const remainingSeconds = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    return { allowed: false, remainingSeconds };
  }
  
  return { allowed: true };
};

// Helper: Record failed attempt
const recordFailedAttempt = (identifier) => {
  const record = rateLimitStore.get(identifier) || { attempts: 0, lockedUntil: 0 };
  record.attempts += 1;
  
  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION;
    record.attempts = 0;
    logger.warn(`[Device Auth] Lockout triggered for: ${identifier}`);
  }
  
  rateLimitStore.set(identifier, record);
};

// Helper: Clear rate limit on success
const clearRateLimit = (identifier) => {
  rateLimitStore.delete(identifier);
};

// Helper: Log access attempt
const logAccessAttempt = (type, success, details) => {
  const logData = {
    type,
    success,
    timestamp: new Date().toISOString(),
    ...details
  };
  
  if (success) {
    logger.info(`[Device Auth] ${type} SUCCESS: ${JSON.stringify(logData)}`);
  } else {
    logger.warn(`[Device Auth] ${type} FAILED: ${JSON.stringify(logData)}`);
  }
};

/**
 * Generate registration options for a new device
 * Only allowed from whitelisted IP for admin users
 */
export const getRegistrationOptions = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);
    const clientIP = getClientIP(req);

    if (!user || user.role !== 'admin') {
      logAccessAttempt('REGISTER_OPTIONS', false, { userId, ip: clientIP, reason: 'not_admin' });
      return res.status(404).json({ message: 'Not Found' });
    }

    // Get existing devices
    const existingDevices = await TrustedDevice.getActiveDevices(userId);
    
    // Check device limit (configurable, default 10)
    const maxDevices = parseInt(process.env.MAX_TRUSTED_DEVICES) || 10;
    if (existingDevices.length >= maxDevices) {
      logAccessAttempt('REGISTER_OPTIONS', false, { userId, ip: clientIP, reason: 'device_limit' });
      return res.status(400).json({ message: `Maximum ${maxDevices} devices allowed` });
    }
    
    const excludeCredentials = existingDevices.map(device => ({
      id: device.credentialId.toString('base64url'),
      type: 'public-key',
      transports: device.transports || ['internal'],
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(userId.toString())),
      userName: user.email,
      userDisplayName: user.name || user.email,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
        authenticatorAttachment: 'platform',
      },
      timeout: 60000, // 60 seconds timeout
    });

    // Store challenge
    challengeStore.set(userId.toString(), {
      challenge: options.challenge,
      expires: Date.now() + 60000,
    });

    logAccessAttempt('REGISTER_OPTIONS', true, { userId, ip: clientIP });
    // DEBUG: Log options structure
    if (process.env.NODE_ENV === 'development') {
        logger.debug('[Device Auth] Options sent to client:', JSON.stringify({ 
            ...options, 
            userID: '[HIDDEN]', 
            challenge: options.challenge ? (options.challenge.length + ' chars') : 'MISSING'
        }));
    }
    res.json(options);
  } catch (error) {
    logger.error('[Device Auth] Registration options error:', error);
    res.status(500).json({ message: 'Internal error', error: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
  }
};

/**
 * Verify registration response and save device
 */
export const verifyRegistration = async (req, res) => {
  const clientIP = getClientIP(req);
  
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);

    if (!user || user.role !== 'admin') {
      logAccessAttempt('REGISTER_VERIFY', false, { userId, ip: clientIP, reason: 'not_admin' });
      return res.status(404).json({ message: 'Not Found' });
    }

    const { response, deviceName, deviceInfo } = req.body;

    // Get stored challenge
    const stored = challengeStore.get(userId.toString());
    if (!stored || Date.now() > stored.expires) {
      logAccessAttempt('REGISTER_VERIFY', false, { userId, ip: clientIP, reason: 'challenge_expired' });
      return res.status(400).json({ message: 'Challenge expired' });
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      logAccessAttempt('REGISTER_VERIFY', false, { userId, ip: clientIP, reason: 'verification_failed' });
      return res.status(400).json({ message: 'Verification failed' });
    }

    // Clear challenge
    challengeStore.delete(userId.toString());

    // === DUPLICATE DEVICE DETECTION ===
    // Check if user already has a device with similar fingerprint
    // If so, auto-deactivate the old one to prevent duplicates
    
    // Sanitize deviceInfo to prevent NoSQL injection
    // Ensure all values are plain strings, max 100 chars each
    const sanitizeDeviceField = (value) => {
      if (typeof value !== 'string') return 'Unknown';
      return String(value).slice(0, 100).trim() || 'Unknown';
    };
    
    const deviceFingerprint = {
      model: sanitizeDeviceField(deviceInfo?.model),
      os: sanitizeDeviceField(deviceInfo?.os),
      browser: sanitizeDeviceField(deviceInfo?.browser).replace(' (PWA)', ''), // Normalize PWA suffix
    };
    
    const existingDevices = await TrustedDevice.find({ 
      userId, 
      isActive: true,
      deviceModel: deviceFingerprint.model,
      deviceOS: deviceFingerprint.os,
    });
    
    // Deactivate old devices with same fingerprint (likely re-registration after data clear)
    if (existingDevices.length > 0) {
      for (const oldDevice of existingDevices) {
        // Match browser (ignore PWA suffix difference)
        const oldBrowser = (oldDevice.browser || '').replace(' (PWA)', '');
        if (oldBrowser === deviceFingerprint.browser) {
          await TrustedDevice.revokeDevice(oldDevice._id, userId);
          logAccessAttempt('DEVICE_AUTO_REVOKE', true, { 
            userId, 
            ip: clientIP, 
            oldDeviceId: oldDevice._id,
            reason: 'duplicate_device_re-registration'
          });
        }
      }
    }

    // Extract credential info (Support simplewebauthn v13 structure)
    const regInfo = verification.registrationInfo;
    let credId = regInfo.credentialID;
    let credPublicKey = regInfo.credentialPublicKey;
    
    // v13+ specific: data nests under 'credential' object
    if (!credId && regInfo.credential) {
      credId = regInfo.credential.id;
      credPublicKey = regInfo.credential.publicKey;
    }

    if (!credId || !credPublicKey) {
       logger.error('[Device Auth] CRITICAL: Missing credentialID or publicKey:', Object.keys(regInfo));
       return res.status(500).json({ message: 'Server error: Invalid authenticator data' });
    }

    const credIdBuffer = credId instanceof Buffer ? credId : Buffer.from(credId, 'base64url');
    const credPublicKeyBuffer = credPublicKey instanceof Buffer ? credPublicKey : Buffer.from(credPublicKey, 'base64url');



    const trustedDevice = new TrustedDevice({
      userId,
      credentialId: credIdBuffer,
      publicKey: credPublicKeyBuffer,
      counter: verification.registrationInfo.counter,
      transports: response.response?.transports || ['internal'],
      deviceName: typeof deviceName === 'string' ? String(deviceName).slice(0, 50).trim() || 'Unknown Device' : 'Unknown Device',
      deviceModel: deviceFingerprint.model,
      deviceOS: deviceFingerprint.os,
      browser: deviceFingerprint.browser,
      registeredIP: clientIP,
      registeredGeo: {
        city: 'Unknown',
        country: 'Unknown',
        isp: 'Unknown',
      },
    });

    await trustedDevice.save();

    logAccessAttempt('REGISTER_VERIFY', true, { 
      userId, 
      ip: clientIP, 
      deviceId: trustedDevice._id,
      deviceName: trustedDevice.deviceName
    });

    res.json({
      success: true,
      deviceId: trustedDevice._id,
      message: 'Device registered successfully',
    });
  } catch (error) {
    logger.error('[Device Auth] Registration verify error:', error);
    logAccessAttempt('REGISTER_VERIFY', false, { ip: clientIP, error: error.message });
    res.status(500).json({ message: 'Internal error' });
  }
};

/**
 * Generate authentication challenge
 * This is called BEFORE login to check if device exists
 */
export const getAuthenticationOptions = async (req, res) => {
  const clientIP = getClientIP(req);
  
  try {
    // Check rate limit
    const rateCheck = checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      logAccessAttempt('AUTH_OPTIONS', false, { ip: clientIP, reason: 'rate_limited' });
      return res.status(429).json({ 
        message: `Too many attempts. Try again in ${rateCheck.remainingSeconds} seconds`,
        retryAfter: rateCheck.remainingSeconds
      });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      allowCredentials: [],
      timeout: 60000,
    });

    // Store challenge with a temporary ID
    const tempId = `auth_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    challengeStore.set(tempId, {
      challenge: options.challenge,
      expires: Date.now() + 60000,
      ip: clientIP, // Track IP for logging
    });

    res.json({
      ...options,
      challengeId: tempId,
    });
  } catch (error) {
    logger.error('[Device Auth] Auth options error:', error);
    res.status(500).json({ message: 'Internal error' });
  }
};

/**
 * Verify authentication and grant access with JWT tokens
 */
export const verifyAuthentication = async (req, res) => {
  const clientIP = getClientIP(req);
  
  try {
    // Check rate limit
    const rateCheck = checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      logAccessAttempt('AUTH_VERIFY', false, { ip: clientIP, reason: 'rate_limited' });
      return res.status(429).json({ 
        message: `Too many attempts. Try again in ${rateCheck.remainingSeconds} seconds`,
        retryAfter: rateCheck.remainingSeconds
      });
    }

    const { response, challengeId } = req.body;

    // Get stored challenge
    const stored = challengeStore.get(challengeId);
    if (!stored || Date.now() > stored.expires) {
      recordFailedAttempt(clientIP);
      logAccessAttempt('AUTH_VERIFY', false, { ip: clientIP, reason: 'challenge_expired' });
      return res.status(400).json({ message: 'Challenge expired' });
    }

    // Find the device by credential ID
    const credentialId = Buffer.from(response.id, 'base64url');
    const device = await TrustedDevice.findOne({
      credentialId,
      isActive: true,
    }).populate('userId');

    if (!device) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('[Device Auth] Device not found for ID (Base64URL):', response.id);
        logger.debug('[Device Auth] Converted Buffer:', credentialId);
      }
      recordFailedAttempt(clientIP);
      logAccessAttempt('AUTH_VERIFY', false, { ip: clientIP, reason: 'device_not_found' });
      return res.status(400).json({ message: 'Invalid credential' });
    }

    if (process.env.NODE_ENV === 'development') {
       logger.debug('[Device Auth] Verifying device:', {
         id: device._id,
         counter: device.counter,
         credentialIdLen: device.credentialId.length
       });
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: device.credentialId,
        credentialPublicKey: device.publicKey,
        counter: device.counter,
      },
      // Support newer simplewebauthn versions (v11+) which use 'credential'
      credential: {
        id: device.credentialId,
        publicKey: device.publicKey,
        counter: device.counter,
      }
    });

    if (!verification.verified) {
      if (process.env.NODE_ENV === 'development') {
         logger.debug('[Device Auth] Verification failed result:', JSON.stringify(verification, null, 2));
      }
      recordFailedAttempt(clientIP);
      logAccessAttempt('AUTH_VERIFY', false, { 
        ip: clientIP, 
        deviceId: device._id,
        reason: 'biometric_failed' 
      });
      return res.status(400).json({ message: 'Verification failed' });
    }

    // Clear challenge
    challengeStore.delete(challengeId);

    // Update counter (replay protection)
    device.counter = verification.authenticationInfo.newCounter;

    // Update last access
    await device.updateLastAccess(clientIP, {});

    // Check if user is still admin
    const user = device.userId;
    if (!user || user.role !== 'admin') {
      recordFailedAttempt(clientIP);
      logAccessAttempt('AUTH_VERIFY', false, { 
        ip: clientIP, 
        userId: user?._id,
        reason: 'not_admin' 
      });
      return res.status(400).json({ message: 'Invalid credential' });
    }

    // Check if user is banned
    if (!user.isActive) {
      logAccessAttempt('AUTH_VERIFY', false, { 
        ip: clientIP, 
        userId: user._id,
        reason: 'user_banned' 
      });
      return res.status(403).json({ message: 'Account suspended' });
    }

    // Clear rate limit on success
    clearRateLimit(clientIP);

    // === CRITICAL FIX: Generate JWT tokens ===
    const accessToken = generateAccessToken(user._id);
    const { refreshToken } = await createSession(user._id, req);

    // Update lastLoginAt (for user activity tracking)
    await User.findByIdAndUpdate(user._id, { $set: { lastLoginAt: new Date() } });

    // Set refresh token cookie
    res.cookie('jwt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: getCookieSameSite(),
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Create Audit Log (LoginHistory)
    await LoginHistory.create({
      userId: user._id,
      email: user.email,
      ip: clientIP,
      userAgent: req.headers['user-agent'],
      status: 'success',
      authMethod: 'biometric',
      deviceId: device._id,
      deviceName: device.deviceName
    });

    logAccessAttempt('AUTH_VERIFY', true, { 
      ip: clientIP, 
      userId: user._id,
      deviceId: device._id,
      deviceName: device.deviceName
    });

    res.json({
      success: true,
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      accessToken,
      deviceId: device._id,
      message: 'Authentication successful',
    });
  } catch (error) {
    logger.error('[Device Auth] Auth verify error:', error);
    recordFailedAttempt(clientIP);
    logAccessAttempt('AUTH_VERIFY', false, { ip: clientIP, error: error.message });
    res.status(500).json({ message: 'Internal error' });
  }
};

/**
 * Get all trusted devices for current user
 */
export const getDevices = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const devices = await TrustedDevice.find({ userId })
      .select('-credentialId -publicKey');
      // .sort({ updatedAt: -1 }); // Removed to fix Cosmos DB specific error
    
    // Sort in memory instead (list is small, usually < 10)
    devices.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json(devices);
  } catch (error) {
    logger.error('[Device Auth] Get devices error:', error);
    res.status(500).json({ message: 'Internal error', error: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
  }
};

/**
 * Update device name
 */
export const updateDeviceName = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { deviceId } = req.params;
    const { deviceName } = req.body;

    const device = await TrustedDevice.findOne({ _id: deviceId, userId });
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    device.deviceName = deviceName?.slice(0, 50) || device.deviceName;
    await device.save();

    logAccessAttempt('DEVICE_UPDATE', true, { userId, deviceId, newName: device.deviceName });
    res.json({ success: true, deviceName: device.deviceName });
  } catch (error) {
    logger.error('[Device Auth] Update device error:', error);
    res.status(500).json({ message: 'Internal error' });
  }
};

/**
 * Revoke a specific device
 */
export const revokeDevice = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { deviceId } = req.params;

    const device = await TrustedDevice.findOne({ _id: deviceId, userId });
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    await TrustedDevice.revokeDevice(deviceId, userId);

    logAccessAttempt('DEVICE_REVOKE', true, { userId, deviceId, deviceName: device.deviceName });
    res.json({ success: true, message: 'Device revoked' });
  } catch (error) {
    logger.error('[Device Auth] Revoke device error:', error);
    res.status(500).json({ message: 'Internal error' });
  }
};

/**
 * Revoke all devices for current user
 */
export const revokeAllDevices = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    const result = await TrustedDevice.revokeAllDevices(userId, userId);

    logAccessAttempt('DEVICE_REVOKE_ALL', true, { userId, count: result.modifiedCount });
    res.json({
      success: true,
      revokedCount: result.modifiedCount,
      message: 'All devices revoked',
    });
  } catch (error) {
    logger.error('[Device Auth] Revoke all error:', error);
    res.status(500).json({ message: 'Internal error' });
  }
};

/**
 * Check if current request has a trusted device
 * Used by ipWhitelist middleware
 */
export const checkTrustedDevice = async (credentialId) => {
  try {
    const device = await TrustedDevice.findOne({
      credentialId: Buffer.from(credentialId, 'base64url'),
      isActive: true,
    }).populate('userId');

    if (device && device.userId && device.userId.role === 'admin') {
      return { trusted: true, userId: device.userId._id };
    }

    return { trusted: false };
  } catch (error) {
    logger.error('[Device Auth] Check trusted device error:', error);
    return { trusted: false };
  }
};
