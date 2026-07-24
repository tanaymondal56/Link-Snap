import crypto from 'crypto';
import Session from '../models/Session.js';
import { parseUserAgent } from './parseUserAgent.js';
import { generateRefreshToken } from './generateToken.js';
import logger from './logger.js';
import { getUserIP } from '../middleware/strictProxyGate.js';

// Session configuration - can be moved to env for easier tuning
const MAX_SESSIONS_PER_USER = parseInt(process.env.MAX_SESSIONS_PER_USER) || 10;
const SESSION_DURATION_DAYS = parseInt(process.env.SESSION_DURATION_DAYS) || 30;
const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Hash a refresh token using SHA256
 * @param {string} token - Raw refresh token
 * @returns {string} Hashed token
 */
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Get client IP address from request
 * Uses getUserIP from strictProxyGate for proper proxy-aware extraction
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
export const getClientIP = (req) => {
  return getUserIP(req);
};

/**
 * Mask IP address for display (privacy)
 * @param {string} ip - Full IP address
 * @returns {string} Masked IP (e.g., 192.168.1.xxx)
 */
export const maskIP = (ip) => {
  if (!ip || ip === 'Unknown') return 'Unknown';
  
  // Handle IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length > 4) {
      return parts.slice(0, 4).join(':') + ':xxxx:xxxx';
    }
    return ip;
  }
  
  // Handle IPv4
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }
  
  return ip;
};

/**
 * Create a new session for a user
 * @param {string} userId - User's MongoDB ID
 * @param {Object} req - Express request object (for IP and User-Agent)
 * @returns {Object} { refreshToken, session }
 */
export const createSession = async (userId, req) => {
  // Generate refresh token
  const refreshToken = generateRefreshToken(userId);
  const tokenHash = hashToken(refreshToken);
  
  // Parse device info from User-Agent
  const userAgentString = req.headers['user-agent'] || '';
  const deviceInfo = parseUserAgent(userAgentString);
  
  // Get client IP
  const ipAddress = getClientIP(req);
  
  // Check session limit
  // Check session limit
  const sessionCount = await Session.countDocuments({ userId }); // Use fast count
  if (sessionCount >= MAX_SESSIONS_PER_USER) {
    // Efficiently find and delete the oldest session in one go if possible, 
    // or minimally find specific ID then delete.
    // Mongoose doesn't have a direct "delete oldest" one-liner that is standard across versions without loaded doc,
    // so we'll fetch the ID of the oldest and delete it.
    const oldestSession = await Session.findOne({ userId })
      .sort({ lastActiveAt: 1 })
      .select('_id');
      
    if (oldestSession) {
      await Session.deleteOne({ _id: oldestSession._id });
      logger.info(`[Session] Removed oldest session for user ${userId} (limit reached)`);
    }
  }
  
  // Generate DBSC tracking ID
  const dbscSessionId = crypto.randomUUID();

  // Create session document
  const session = await Session.create({
    userId,
    tokenHash,
    deviceInfo,
    ipAddress,
    dbscSessionId,
    userAgent: userAgentString.substring(0, 500), // Limit length
    lastActiveAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
  });
  
  logger.info(`[Session] Created new session for user ${userId}: ${deviceInfo.browser} on ${deviceInfo.os}`);
  
  return { refreshToken, session, dbscSessionId };
};

/**
 * Validate a refresh token and return the session
 * @param {string} token - Raw refresh token
 * @returns {Object|null} Session document or null if invalid
 */
export const validateSession = async (token) => {
  const tokenHash = hashToken(token);
  
  // Find either by current token, or by previous token (if still in the 30-second grace window)
  const session = await Session.findOne({
    $or: [
      { tokenHash: tokenHash },
      { 
        previousTokenHash: tokenHash, 
        previousTokenValidUntil: { $gt: new Date() } 
      }
    ]
  });
  
  if (!session) {
    return null;
  }
  
  // Check if expired (belt and suspenders - TTL should handle this)
  if (session.expiresAt < new Date()) {
    await session.deleteOne();
    return null;
  }
  
  // If the user authenticated with the previous token during the grace period,
  // we still return the session, but we also indicate this was a grace period hit
  // so the controller knows to rotate the token immediately again.
  if (session.previousTokenHash === tokenHash) {
     session.isGracePeriodHit = true;
  }
  
  return session;
};

/**
 * Update session's lastActiveAt and optionally IP
 * @param {Object} session - Session document
 * @param {Object} req - Express request object
 */
export const refreshSessionActivity = async (session, req) => {
  const updates = {
    lastActiveAt: new Date()
  };
  
  // Update IP if changed (mobile users moving between networks)
  const currentIP = getClientIP(req);
  if (currentIP !== session.ipAddress && currentIP !== 'Unknown') {
    updates.ipAddress = currentIP;
  }
  
  await Session.findByIdAndUpdate(session._id, updates);
};

/**
 * Terminate a session by deleting it
 * @param {string} token - Raw refresh token
 * @returns {boolean} True if session was found and deleted
 */
export const terminateSession = async (token) => {
  const tokenHash = hashToken(token);
  const session = await Session.findOneAndDelete({ tokenHash });
  return session;
};

/**
 * Terminate all sessions for a user (e.g., when banned)
 * @param {string} userId - User's MongoDB ID
 * @returns {number} Number of sessions terminated
 */
export const terminateAllUserSessions = async (userId) => {
  const result = await Session.deleteMany({ userId });
  logger.info(`[Session] Terminated ${result.deletedCount} sessions for user ${userId}`);
  return result.deletedCount;
};

/**
 * Rotate a refresh token for security.
 * Atomically replaces the old tokenHash with a new one in the session document.
 * Uses optimistic locking: if another concurrent request already rotated the token,
 * this will return null (the session won't be found by the old hash).
 *
 * This prevents replay attacks: a stolen refresh token can only be used ONCE.
 *
 * @param {string} oldToken - The current (old) refresh token from cookie
 * @param {Object} req - Express request (for IP logging)
 * @returns {{ newRefreshToken: string, session: Object }|null} Null if token already used
 */
export const rotateRefreshToken = async (oldToken, req) => {
  const oldTokenHash = hashToken(oldToken);

  // Find the session while it's still valid (has old hash, not expired)
  const existingSession = await Session.findOne({
    tokenHash: oldTokenHash,
    expiresAt: { $gt: new Date() }
  });

  if (!existingSession) return null;

  // Generate a fresh refresh token for this user
  const newRefreshToken = generateRefreshToken(existingSession.userId);
  const newTokenHash = hashToken(newRefreshToken);

  // Security: Device Binding Check
  // Ensure the User-Agent hasn't drastically changed (indicates token theft)
  const incomingUA = req.headers['user-agent'] || '';
  const incomingDeviceInfo = parseUserAgent(incomingUA);
  const sessionDeviceInfo = existingSession.deviceInfo;
  
  if (
    incomingDeviceInfo.os !== sessionDeviceInfo.os ||
    incomingDeviceInfo.browser !== sessionDeviceInfo.browser
  ) {
    logger.warn(`[Security] Session hijack attempt detected for user ${existingSession.userId}. UA mismatch: ${sessionDeviceInfo.os}/${sessionDeviceInfo.browser} vs ${incomingDeviceInfo.os}/${incomingDeviceInfo.browser}`);
    await Session.deleteOne({ _id: existingSession._id });
    return null;
  }

  const currentIP = getClientIP(req);
  const ipUpdates = currentIP !== existingSession.ipAddress && currentIP !== 'Unknown'
    ? { ipAddress: currentIP }
    : {};

  // Atomic conditional update: only succeeds if the session STILL has the old hash.
  // If two concurrent requests reach here simultaneously, only one will win.
  // The loser will receive null, triggering a re-authentication.
  // However, because we set previousTokenHash, if the loser retries or a parallel request
  // sends the old token, validateSession will still accept it for 30 seconds.
  const gracePeriodEnd = new Date(Date.now() + 30 * 1000); // 30 seconds
  const updated = await Session.findOneAndUpdate(
    { _id: existingSession._id, tokenHash: oldTokenHash }, // Condition: still the old token
    { 
       tokenHash: newTokenHash, 
       lastActiveAt: new Date(),
       previousTokenHash: oldTokenHash,
       previousTokenValidUntil: gracePeriodEnd,
       ...ipUpdates 
    },
    { returnDocument: 'before' } // Return old doc (we just need to confirm it matched)
  );

  if (!updated) {
    // Race condition: another request already rotated this token.
    // In our new architecture, validateSession allows the old token for 30s,
    // so this parallel request would have succeeded initially. But for the rotate,
    // we just safely ignore and let the first rotation win.
    logger.warn(`[Session] Refresh token rotation race condition detected for session ${existingSession._id}. Handled gracefully.`);
    return null;
  }

  return { newRefreshToken, session: existingSession };
};


/**
 * Format session for API response
 * @param {Object} session - Session document
 * @param {string} currentTokenHash - Hash of current request's token (to mark current session)
 * @returns {Object} Formatted session data
 */
export const formatSessionForResponse = (session, currentTokenHash = null) => {
  return {
    id: session._id,
    deviceInfo: {
      browser: session.deviceInfo.browser,
      browserVersion: session.deviceInfo.browserVersion,
      os: session.deviceInfo.os,
      osVersion: session.deviceInfo.osVersion,
      device: session.deviceInfo.device,
      deviceModel: session.deviceInfo.deviceModel || '',
      deviceVendor: session.deviceInfo.deviceVendor || '',
      cpuArch: session.deviceInfo.cpuArch || '',
      isMobile: session.deviceInfo.isMobile
    },
    ipAddress: maskIP(session.ipAddress),
    location: session.location,
    customName: session.customName || '',
    isTrusted: session.isTrusted || false,
    lastActiveAt: session.lastActiveAt,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    isCurrent: currentTokenHash ? session.tokenHash === currentTokenHash : false
  };
};

export default {
  hashToken,
  getClientIP,
  maskIP,
  createSession,
  validateSession,
  refreshSessionActivity,
  terminateSession,
  terminateAllUserSessions,
  formatSessionForResponse
};
