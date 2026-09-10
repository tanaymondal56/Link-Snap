import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { LRUCache } from 'lru-cache';
import TrustedDevice from '../models/TrustedDevice.js';
import User from '../models/User.js';
import { generateAccessToken } from '../utils/generateToken.js';
import { createSession } from '../utils/sessionHelper.js';
import { issueDbscRegistration } from './authController.js';
import logger from '../utils/logger.js';
import LoginHistory from '../models/LoginHistory.js';
import { getUserIP } from '../middleware/strictProxyGate.js';
import { redisGet, redisSet, redisDel, redisIncr, redisGetDel, getRedisClient } from '../config/redis.js';

// Config - Strictly permitted origins and RP IDs
const rpName = process.env.WEBAUTHN_RP_NAME || 'Link Snap Admin';
const rpID = process.env.WEBAUTHN_RP_ID || (process.env.NODE_ENV === 'production' ? 'lksnp.qzz.io' : 'localhost');

const ALLOWED_ORIGINS = [
  'https://lksnp.qzz.io',
  'https://beta.lksnp.qzz.io',
  'http://localhost:3000',
];

const ALLOWED_RP_IDS = [
  'lksnp.qzz.io',
  'localhost',
];

// In-memory LRU cache fallback (max items + TTL prevents OOM/DoS without nuclear clear)
const challengeStore = new LRUCache({ max: 5000, ttl: 60000 });
const rateLimitStore = new LRUCache({ max: 5000, ttl: 300000 }); // 5 min attempt window matching Redis
const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION = 30000; // 30 seconds

export const stopDeviceAuthIntervals = () => {
  // LRUCache handles TTL evictions automatically; no interval needed
};

/**
 * Safely converts Buffer, Uint8Array, or BSON Binary to base64url string
 */
const toBase64Url = (credId) => {
  if (!credId) return '';
  if (typeof credId === 'string') return credId;
  if (Buffer.isBuffer(credId)) return credId.toString('base64url');
  if (credId.buffer && (Buffer.isBuffer(credId.buffer) || credId.buffer instanceof ArrayBuffer)) {
    return Buffer.from(credId.buffer, credId.byteOffset || 0, credId.byteLength || credId.buffer.byteLength).toString('base64url');
  }
  if (typeof credId.value === 'function') {
    const val = credId.value(true);
    if (Buffer.isBuffer(val)) return val.toString('base64url');
    return Buffer.from(val).toString('base64url');
  }
  return Buffer.from(credId).toString('base64url');
};

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
const checkRateLimit = async (identifier) => {
  const redis = getRedisClient();
  if (redis) {
    const locked = await redisGet(`ls:wn:rl:${identifier}`);
    if (locked) {
      const remainingSeconds = Math.ceil((locked.lockedUntil - Date.now()) / 1000);
      return { allowed: false, remainingSeconds: remainingSeconds > 0 ? remainingSeconds : 30 };
    }
    return { allowed: true };
  }

  const record = rateLimitStore.get(identifier);
  if (!record) return { allowed: true };
  
  if (Date.now() < record.lockedUntil) {
    const remainingSeconds = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    return { allowed: false, remainingSeconds };
  }
  
  return { allowed: true };
};

// Helper: Record failed attempt
const recordFailedAttempt = async (identifier) => {
  const redis = getRedisClient();
  if (redis) {
    const attemptsKey = `ls:wn:attempts:${identifier}`;
    const attempts = await redisIncr(attemptsKey, 300); // 5 min TTL
    if (attempts && attempts >= MAX_ATTEMPTS) {
      const lockedUntil = Date.now() + LOCKOUT_DURATION;
      await redisSet(`ls:wn:rl:${identifier}`, LOCKOUT_DURATION / 1000, { lockedUntil });
      await redisDel(attemptsKey);
      logger.warn(`[Device Auth] Lockout triggered for: ${identifier}`);
    }
    return;
  }

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
const clearRateLimit = async (identifier) => {
  const redis = getRedisClient();
  if (redis) {
    await redisDel(`ls:wn:rl:${identifier}`, `ls:wn:attempts:${identifier}`);
    return;
  }
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

    if (!user || user.role !== 'admin' || !user.isActive) {
      logAccessAttempt('REGISTER_OPTIONS', false, { userId, ip: clientIP, reason: 'not_admin_or_inactive' });
      return res.status(404).json({ message: 'Not Found' });
    }

    // Get existing devices
    const existingDevices = await TrustedDevice.getActiveDevices(userId);
    
    // Check device limit (configurable, default 10)
    const maxDevices = parseInt(process.env.MAX_TRUSTED_DEVICES, 10) || 10;
    if (existingDevices.length >= maxDevices) {
      logAccessAttempt('REGISTER_OPTIONS', false, { userId, ip: clientIP, reason: 'device_limit' });
      return res.status(400).json({ message: `Maximum ${maxDevices} devices allowed` });
    }
    
    const excludeCredentials = existingDevices.map(device => ({
      id: toBase64Url(device.credentialId),
      type: 'public-key',
      transports: device.transports?.length > 0 ? device.transports : ['internal'],
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(userId.toString(), 'utf8')),
      userName: user.email,
      userDisplayName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user.username || user.email),
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
        authenticatorAttachment: 'platform',
      },
      timeout: 60000, // 60 seconds timeout
    });

    // Store challenge
    const redis = getRedisClient();
    if (redis) {
      await redisSet(`ls:wn:challenge:${userId}`, 60, {
        challenge: options.challenge,
        expires: Date.now() + 60000,
      });
    } else {
      challengeStore.set(userId.toString(), {
        challenge: options.challenge,
        expires: Date.now() + 60000,
      });
    }

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
    const rateCheck = await checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      logAccessAttempt('REGISTER_VERIFY', false, { ip: clientIP, reason: 'rate_limited' });
      return res.status(429).json({
        message: `Too many attempts. Try again in ${rateCheck.remainingSeconds} seconds`,
        retryAfter: rateCheck.remainingSeconds,
      });
    }

    const { response, deviceName, deviceInfo } = req.body || {};
    if (!response || typeof response !== 'object' || typeof response.id !== 'string') {
      await recordFailedAttempt(clientIP);
      return res.status(400).json({ message: 'Invalid registration response payload' });
    }

    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);
 
    if (!user || user.role !== 'admin' || !user.isActive) {
      await recordFailedAttempt(clientIP);
      logAccessAttempt('REGISTER_VERIFY', false, { userId, ip: clientIP, reason: 'not_admin_or_inactive' });
      return res.status(404).json({ message: 'Not Found' });
    }

    // Check device limit
    const existingDevices = await TrustedDevice.getActiveDevices(userId);
    const maxDevices = parseInt(process.env.MAX_TRUSTED_DEVICES, 10) || 10;
    const isReRegistration = existingDevices.some(d => toBase64Url(d.credentialId) === response.id);
    if (!isReRegistration && existingDevices.length >= maxDevices) {
      return res.status(400).json({ message: `Maximum ${maxDevices} devices allowed` });
    }
 
    // Get stored challenge
    let stored;
    const redisInstance = getRedisClient();
    if (redisInstance) {
      stored = await redisGetDel(`ls:wn:challenge:${userId}`);
    } else {
      stored = challengeStore.get(userId.toString());
      if (stored) challengeStore.delete(userId.toString());
    }
    
    if (!stored || Date.now() > stored.expires) {
      await recordFailedAttempt(clientIP);
      logAccessAttempt('REGISTER_VERIFY', false, { userId, ip: clientIP, reason: 'challenge_expired' });
      return res.status(400).json({ message: 'Challenge expired' });
    }
 
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: ALLOWED_ORIGINS,
      expectedRPID: ALLOWED_RP_IDS,
      requireUserVerification: true,
    });
 
    if (!verification.verified || !verification.registrationInfo) {
      await recordFailedAttempt(clientIP);
      logAccessAttempt('REGISTER_VERIFY', false, { userId, ip: clientIP, reason: 'verification_failed' });
      return res.status(400).json({ message: 'Verification failed' });
    }
 
    // Clear challenge
    challengeStore.delete(userId.toString());

    // Sanitize deviceInfo to prevent NoSQL injection
    const sanitizeDeviceField = (value) => {
      if (typeof value !== 'string') return 'Unknown';
      return String(value).slice(0, 100).trim() || 'Unknown';
    };
    
    const deviceFingerprint = {
      model: sanitizeDeviceField(deviceInfo?.model),
      os: sanitizeDeviceField(deviceInfo?.os),
      browser: sanitizeDeviceField(deviceInfo?.browser).replace(' (PWA)', ''), // Normalize PWA suffix
    };

    // Canonical SimpleWebAuthn v14 credential data
    const regInfo = verification.registrationInfo;
    const credential = regInfo.credential;

    if (!credential?.id || !credential?.publicKey) {
       logger.error('[Device Auth] CRITICAL: Missing credential.id or publicKey in registrationInfo:', Object.keys(regInfo));
       return res.status(500).json({ message: 'Server error: Invalid authenticator data' });
    }

    const credIdBuffer = Buffer.from(credential.id, 'base64url');
    // In v14, credential.publicKey is Uint8Array; wrap directly in Buffer
    const credPublicKeyBuffer = Buffer.from(credential.publicKey);

    // If this exact credential ID was previously registered by this user, revoke the prior record
    await TrustedDevice.updateMany(
      { userId, credentialId: credIdBuffer, isActive: true },
      { $set: { isActive: false, revokedAt: new Date() } }
    );

    const resolvedTransports = (credential.transports?.length > 0)
      ? credential.transports
      : (response.response?.transports?.length > 0)
        ? response.response.transports
        : ['internal'];

    const trustedDevice = new TrustedDevice({
      userId,
      credentialId: credIdBuffer,
      publicKey: credPublicKeyBuffer,
      counter: credential.counter ?? 0, // Canonical v14 location
      credentialDeviceType: regInfo.credentialDeviceType || 'singleDevice',
      credentialBackedUp: Boolean(regInfo.credentialBackedUp),
      aaguid: regInfo.aaguid || null,
      transports: resolvedTransports,
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
    await clearRateLimit(clientIP);

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
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Credential already registered and active' });
    }
    logger.error('[Device Auth] Registration verify error:', error);
    await recordFailedAttempt(clientIP);
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
    const rateCheck = await checkRateLimit(clientIP);
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
      timeout: 60000,
    });

    // Store challenge with a cryptographically secure temporary ID
    const tempId = `auth_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    const redis = getRedisClient();
    if (redis) {
      await redisSet(`ls:wn:challenge:${tempId}`, 60, {
        challenge: options.challenge,
        expires: Date.now() + 60000,
        ip: clientIP, // Track IP for logging
      });
    } else {
      challengeStore.set(tempId, {
        challenge: options.challenge,
        expires: Date.now() + 60000,
        ip: clientIP, // Track IP for logging
      });
    }

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
    const rateCheck = await checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      logAccessAttempt('AUTH_VERIFY', false, { ip: clientIP, reason: 'rate_limited' });
      return res.status(429).json({ 
        message: `Too many attempts. Try again in ${rateCheck.remainingSeconds} seconds`,
        retryAfter: rateCheck.remainingSeconds
      });
    }

    const { response, challengeId } = req.body || {};
    if (!response || typeof response !== 'object' || typeof response.id !== 'string' || !challengeId || typeof challengeId !== 'string') {
      await recordFailedAttempt(clientIP);
      return res.status(400).json({ message: 'Invalid authentication request payload' });
    }

    // Get stored challenge
    let stored;
    const redis = getRedisClient();
    if (redis) {
      stored = await redisGetDel(`ls:wn:challenge:${challengeId}`);
    } else {
      stored = challengeStore.get(challengeId);
      if (stored) challengeStore.delete(challengeId);
    }

    if (!stored || Date.now() > stored.expires) {
      await recordFailedAttempt(clientIP);
      logAccessAttempt('AUTH_VERIFY', false, { ip: clientIP, reason: 'challenge_expired' });
      return res.status(400).json({ message: 'Challenge expired' });
    }

    // Scope guard (defense-in-depth): challenges issued for the authenticated
    // passkey health-check (scope:'verify') must never be redeemable for a
    // login session, and vice-versa.
    if (stored.scope === 'verify') {
      await recordFailedAttempt(clientIP);
      logAccessAttempt('AUTH_VERIFY', false, { ip: clientIP, reason: 'scope_mismatch' });
      return res.status(400).json({ message: 'Invalid challenge' });
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
      await recordFailedAttempt(clientIP);
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

    // Convert stored MongoDB Buffer to Uint8Array safely for SimpleWebAuthn
    const publicKeyUint8 = new Uint8Array(device.publicKey);

    // For synced passkeys (multiDevice), if counter is 0 or unchanged, pass counter = 0
    // to prevent false-positive clone rollback lockout when switching between synced devices
    const isMultiDevice = device.credentialDeviceType === 'multiDevice';
    const effectiveCounter = isMultiDevice ? 0 : device.counter;

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: ALLOWED_ORIGINS,
      expectedRPID: ALLOWED_RP_IDS,
      expectedTopOrigin: ALLOWED_ORIGINS,
      credential: {
        id: toBase64Url(device.credentialId),
        publicKey: publicKeyUint8,
        counter: effectiveCounter,
        transports: device.transports,
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      if (process.env.NODE_ENV === 'development') {
         logger.debug('[Device Auth] Verification failed result:', JSON.stringify(verification, null, 2));
      }
      await recordFailedAttempt(clientIP);
      logAccessAttempt('AUTH_VERIFY', false, { 
        ip: clientIP, 
        deviceId: device._id,
        reason: 'biometric_failed' 
      });
      return res.status(400).json({ message: 'Verification failed' });
    }

    // Clear challenge from in-memory fallback
    challengeStore.delete(challengeId);

    // CRITICAL: Authorize user BEFORE mutating device state in database
    const user = device.userId;
    if (!user || user.role !== 'admin') {
      await recordFailedAttempt(clientIP);
      logAccessAttempt('AUTH_VERIFY', false, { 
        ip: clientIP, 
        userId: user?._id,
        reason: 'not_admin' 
      });
      return res.status(400).json({ message: 'Invalid credential' });
    }

    // Check if user is banned
    if (!user.isActive) {
      await recordFailedAttempt(clientIP);
      logAccessAttempt('AUTH_VERIFY', false, { 
        ip: clientIP, 
        userId: user._id,
        reason: 'user_banned' 
      });
      return res.status(403).json({ message: 'Account suspended' });
    }

    // Atomic counter & access update (prevents race condition & counter rollback)
    const newCounter = verification.authenticationInfo.newCounter;
    const updateSet = {
      lastAccessIP: clientIP,
      lastAccessGeo: { city: 'Unknown', country: 'Unknown', isp: 'Unknown' },
      updatedAt: new Date(),
    };
    if (verification.authenticationInfo.credentialDeviceType) {
      updateSet.credentialDeviceType = verification.authenticationInfo.credentialDeviceType;
    }
    if (typeof verification.authenticationInfo.credentialBackedUp === 'boolean') {
      updateSet.credentialBackedUp = verification.authenticationInfo.credentialBackedUp;
    }

    await TrustedDevice.updateOne(
      { _id: device._id },
      {
        $max: { counter: newCounter },
        $set: updateSet,
      }
    );

    // Clear rate limit on success
    await clearRateLimit(clientIP);

    // === Generate JWT tokens with admin role and DBSC session binding ===
    const { refreshToken, session: newSession, dbscSessionId } = await createSession(user._id, req);
    await issueDbscRegistration(res, newSession);
    const accessToken = generateAccessToken(user._id, user.role, dbscSessionId);

    // Update lastLoginAt (for user activity tracking)
    await User.findByIdAndUpdate(user._id, { $set: { lastLoginAt: new Date() } });

    // Set refresh token cookie
    res.cookie('jwt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: getCookieSameSite(),
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: getCookieSameSite(),
      maxAge: 15 * 60 * 1000,
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
      deviceId: device._id,
      message: 'Authentication successful',
    });
  } catch (error) {
    logger.error('[Device Auth] Auth verify error:', error);
    await recordFailedAttempt(clientIP);
    logAccessAttempt('AUTH_VERIFY', false, { ip: clientIP, error: error.message });
    res.status(500).json({ message: 'Internal error' });
  }
};

/**
 * Get authentication options for a LOGGED-IN user verifying their own passkey
 * (health-check — NOT a login flow). Challenge is scoped to this user's active
 * credentials and tagged with scope:'verify' so it can never be exchanged for
 * a session via the login verify endpoint.
 */
export const getVerificationOptions = async (req, res) => {
  const clientIP = getClientIP(req);

  try {
    const rateCheck = await checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        message: `Too many attempts. Try again in ${rateCheck.remainingSeconds} seconds`,
        retryAfter: rateCheck.remainingSeconds,
      });
    }

    const devices = await TrustedDevice.find({
      userId: req.user._id,
      isActive: true,
    }).select('credentialId transports').lean();

    if (devices.length === 0) {
      return res.status(404).json({ message: 'No active passkeys found for your account' });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      // Narrow the ceremony to THIS user's passkeys — the browser will only
      // offer credentials it actually holds, which is the health-check itself.
      allowCredentials: devices.map((d) => ({
        id: toBase64Url(d.credentialId),
        transports: d.transports?.length > 0 ? d.transports : ['internal', 'hybrid', 'usb', 'ble', 'nfc'],
      })),
      timeout: 60000,
    });

    const tempId = `vauth_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    const payload = {
      challenge: options.challenge,
      expires: Date.now() + 60000,
      ip: clientIP,
      userId: String(req.user._id),
      scope: 'verify', // cannot be redeemed at /.d/verify (login)
    };
    const redis = getRedisClient();
    if (redis) {
      await redisSet(`ls:wn:challenge:${tempId}`, 60, payload);
    } else {
      challengeStore.set(tempId, payload);
    }

    res.json({ ...options, challengeId: tempId });
  } catch (error) {
    logger.error('[Device Auth] Verify options error:', error);
    res.status(500).json({ message: 'Internal error' });
  }
};

/**
 * Verify a passkey assertion for the CURRENT user WITHOUT creating a session
 * (health-check). Proves the credential is still present on the device and
 * cryptographically valid; updates the counter (replay protection) and last
 * access like a real login would, but issues no tokens.
 */
export const verifyPasskey = async (req, res) => {
  const clientIP = getClientIP(req);

  try {
    const rateCheck = await checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      logAccessAttempt('PASSKEY_VERIFY', false, { ip: clientIP, reason: 'rate_limited' });
      return res.status(429).json({
        message: `Too many attempts. Try again in ${rateCheck.remainingSeconds} seconds`,
        retryAfter: rateCheck.remainingSeconds,
      });
    }

    const { response, challengeId } = req.body || {};
    if (!response || typeof response !== 'object' || typeof response.id !== 'string' || !challengeId || typeof challengeId !== 'string') {
      await recordFailedAttempt(clientIP);
      return res.status(400).json({ message: 'Invalid passkey verification payload' });
    }

    // One-time challenge (same store as login, but scope-checked below)
    let stored;
    const redis = getRedisClient();
    if (redis) {
      stored = await redisGetDel(`ls:wn:challenge:${challengeId}`);
    } else {
      stored = challengeStore.get(challengeId);
      if (stored) challengeStore.delete(challengeId);
    }

    if (!stored || Date.now() > stored.expires) {
      await recordFailedAttempt(clientIP);
      logAccessAttempt('PASSKEY_VERIFY', false, { ip: clientIP, reason: 'challenge_expired' });
      return res.status(400).json({ message: 'Challenge expired' });
    }

    // Scope guard: verification challenges are user-bound and can never be
    // login challenges (and vice versa).
    if (stored.scope !== 'verify' || stored.userId !== String(req.user._id)) {
      await recordFailedAttempt(clientIP);
      logAccessAttempt('PASSKEY_VERIFY', false, { ip: clientIP, reason: 'scope_mismatch' });
      return res.status(400).json({ message: 'Invalid challenge' });
    }

    // The device MUST belong to the authenticated user
    const credentialId = Buffer.from(response.id, 'base64url');
    const device = await TrustedDevice.findOne({
      credentialId,
      userId: req.user._id,
      isActive: true,
    });

    if (!device) {
      await recordFailedAttempt(clientIP);
      logAccessAttempt('PASSKEY_VERIFY', false, {
        ip: clientIP,
        userId: req.user._id,
        reason: 'device_not_found',
      });
      return res.status(400).json({ message: 'No matching active passkey for your account' });
    }

    const publicKeyUint8 = new Uint8Array(device.publicKey);

    const isMultiDevice = device.credentialDeviceType === 'multiDevice';
    const effectiveCounter = isMultiDevice ? 0 : device.counter;

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: ALLOWED_ORIGINS,
      expectedRPID: ALLOWED_RP_IDS,
      expectedTopOrigin: ALLOWED_ORIGINS,
      credential: {
        id: toBase64Url(device.credentialId),
        publicKey: publicKeyUint8,
        counter: effectiveCounter,
        transports: device.transports,
      },
      requireUserVerification: true,
    });

    if (!verification.verified) {
      await recordFailedAttempt(clientIP);
      logAccessAttempt('PASSKEY_VERIFY', false, {
        ip: clientIP,
        deviceId: device._id,
        reason: 'assertion_failed',
      });
      return res.status(400).json({ message: 'Verification failed — the passkey did not validate' });
    }

    // Atomic counter update for replay protection
    const newCounter = verification.authenticationInfo.newCounter;
    const updateSet = {
      lastAccessIP: clientIP,
      lastAccessGeo: { city: 'Unknown', country: 'Unknown', isp: 'Unknown' },
      updatedAt: new Date(),
    };
    if (verification.authenticationInfo.credentialDeviceType) {
      updateSet.credentialDeviceType = verification.authenticationInfo.credentialDeviceType;
    }
    if (typeof verification.authenticationInfo.credentialBackedUp === 'boolean') {
      updateSet.credentialBackedUp = verification.authenticationInfo.credentialBackedUp;
    }

    await TrustedDevice.updateOne(
      { _id: device._id },
      {
        $max: { counter: newCounter },
        $set: updateSet,
      }
    );

    await clearRateLimit(clientIP);
    logAccessAttempt('PASSKEY_VERIFY', true, {
      ip: clientIP,
      userId: req.user._id,
      deviceId: device._id,
    });

    res.json({
      verified: true,
      device: {
        _id: device._id,
        deviceName: device.deviceName,
      },
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Device Auth] Passkey verify error:', error);
    await recordFailedAttempt(clientIP);
    logAccessAttempt('PASSKEY_VERIFY', false, { ip: clientIP, error: error.message });
    res.status(500).json({ message: 'Internal error' });
  }
};

/**
 * Get all trusted devices for current user
 */
export const getDevices = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const rawDevices = await TrustedDevice.find({ userId })
      .select('-publicKey')
      .lean();
    
    // Map credentialId Buffer to Base64URL string for client-side matching & WebAuthn signals
    const devices = rawDevices.map((d) => ({
      ...d,
      credentialId: toBase64Url(d.credentialId),
    }));

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

    if (!mongoose.Types.ObjectId.isValid(deviceId)) {
      return res.status(404).json({ message: 'Device not found' });
    }

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

    if (!mongoose.Types.ObjectId.isValid(deviceId)) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const device = await TrustedDevice.findOne({ _id: deviceId, userId });
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const credIdBase64 = toBase64Url(device.credentialId);
    await TrustedDevice.revokeDevice(deviceId, userId);

    logAccessAttempt('DEVICE_REVOKE', true, { userId, deviceId, deviceName: device.deviceName });
    res.json({ success: true, message: 'Device revoked', credentialId: credIdBase64 });
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
    if (!credentialId || typeof credentialId !== 'string') {
      return { trusted: false };
    }

    const device = await TrustedDevice.findOne({
      credentialId: Buffer.from(credentialId, 'base64url'),
      isActive: true,
    }).populate('userId');

    if (device && device.userId && device.userId.role === 'admin' && device.userId.isActive) {
      return { trusted: true, userId: device.userId._id };
    }

    return { trusted: false };
  } catch (error) {
    logger.error('[Device Auth] Check trusted device error:', error);
    return { trusted: false };
  }
};
