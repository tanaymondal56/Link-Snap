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
  
  // Create session document
  const session = await Session.create({
    userId,
    tokenHash,
    deviceInfo,
    ipAddress,
    userAgent: userAgentString.substring(0, 500), // Limit length
    lastActiveAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
  });
  
  logger.info(`[Session] Created new session for user ${userId}: ${deviceInfo.browser} on ${deviceInfo.os}`);
  
  return { refreshToken, session };
};

/**
 * Validate a refresh token and return the session
 * @param {string} token - Raw refresh token
 * @returns {Object|null} Session document or null if invalid
 */
export const validateSession = async (token) => {
  const tokenHash = hashToken(token);
  const session = await Session.findOne({ tokenHash });
  
  if (!session) {
    return null;
  }
  
  // Check if expired (belt and suspenders - TTL should handle this)
  if (session.expiresAt < new Date()) {
    await session.deleteOne();
    return null;
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
  const result = await Session.deleteOne({ tokenHash });
  return result.deletedCount > 0;
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
