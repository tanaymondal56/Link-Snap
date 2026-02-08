import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import logger from '../utils/logger.js';

// IP Whitelist Middleware for Admin Panel Protection
// Only localhost is allowed by default. Add trusted IPs to .env
const envAllowedIPs = process.env.ADMIN_WHITELIST_IPS ? process.env.ADMIN_WHITELIST_IPS.split(',').map(ip => ip.trim()) : [];
const envTrustedProxies = process.env.TRUSTED_PROXIES ? process.env.TRUSTED_PROXIES.split(',').map(ip => ip.trim()) : [];

const allowedIPs = [
  ...envAllowedIPs
];

// Security: Only log count of configured IPs, not the actual sensitive IP values
if (allowedIPs.length > 0) {
  logger.info(`🛡️ [Security Config] Admin Whitelist configured with ${allowedIPs.length} custom IP(s)`);
}
if (envTrustedProxies.length > 0) {
  logger.info(`🛡️ [Security Config] Trusted Proxies configured with ${envTrustedProxies.length} proxy(ies)`);
}

// Localhost IP patterns (these are always allowed)
const localhostPatterns = [
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
];

/**
 * Check if IP is in Tailscale's CGNAT subnet (100.64.0.0/10)
 * Range: 100.64.0.0 - 100.127.255.255
 */
const isTailscaleSubnet = (ip) => {
  if (!ip || typeof ip !== 'string') return false;
  const normalized = ip.replace(/^::ffff:/, '');
  const parts = normalized.split('.');
  if (parts.length !== 4) return false;
  const firstOctet = parseInt(parts[0], 10);
  const secondOctet = parseInt(parts[1], 10);
  return firstOctet === 100 && secondOctet >= 64 && secondOctet <= 127;
};

// Helper: Check IP Logic
const checkIpAccess = (req) => {
  // Get the actual connection IP (not from headers - can't be spoofed)
  const socketIP = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  const normalizedSocketIP = socketIP.replace(/^::ffff:/, '');

  // Check if request is coming from a trusted proxy:
  // - localhost
  // - explicitly configured TRUSTED_PROXIES
  // - Tailscale subnet (100.64.0.0/10) - for Azure proxy
  const isFromTrustedProxy = localhostPatterns.includes(socketIP) ||
    localhostPatterns.includes(normalizedSocketIP) ||
    normalizedSocketIP === '127.0.0.1' ||
    normalizedSocketIP.startsWith('127.') ||
    envTrustedProxies.includes(normalizedSocketIP) ||
    isTailscaleSubnet(normalizedSocketIP);  // ← Added Tailscale detection

  // Get client IP - prefer realUserIP set by strictProxyGate middleware
  let clientIP;
  if (req.realUserIP) {
    // strictProxyGate already extracted the real user IP
    clientIP = req.realUserIP;
  } else if (isFromTrustedProxy) {
    // Request is from localhost/proxy, trust the forwarded headers
    clientIP =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.ip ||
      socketIP ||
      'unknown';
  } else {
    // Direct connection - use socket IP, ignore headers (prevent spoofing)
    clientIP = socketIP || 'unknown';
  }

  // Normalize IPv6-mapped IPv4 addresses (e.g., ::ffff:192.168.1.5 -> 192.168.1.5)
  const normalizedIP = clientIP.replace(/^::ffff:/, '');

  // Check if it's strictly localhost
  const isLocalhost = localhostPatterns.includes(clientIP) ||
    localhostPatterns.includes(normalizedIP) ||
    normalizedIP === '127.0.0.1' ||
    normalizedIP.startsWith('127.');

  // Check if IP is in the allowed list
  const isInAllowedList = allowedIPs.some(ip => {
    return normalizedIP === ip || clientIP === ip;
  });

  const isAllowed = isLocalhost || isInAllowedList;

  return { isAllowed, clientIP, socketIP, normalizedIP };
};

// 1. Standard IP Whitelist (With Token Bypass)
export const ipWhitelist = async (req, res, next) => {
  try {
    const { isAllowed, clientIP, socketIP, normalizedIP } = checkIpAccess(req);

    // Set the flag on the request object
    req.isWhitelistedIP = isAllowed;

    if (isAllowed) {
      logger.debug(`[IP Whitelist] ✅ Allowed: ${clientIP} (socket: ${socketIP}, normalized: ${normalizedIP})`);
      return next();
    }

    // === BYPASS: Check for valid Admin Token ===
    if (req.headers.authorization?.startsWith('Bearer')) {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      // Check if user is a regular admin
      const user = await User.findById(decoded.id).select('role isActive');

      if (user && user.role === 'admin' && user.isActive) {
        logger.info(`[IP Whitelist] 🔓 Bypass by Admin Token: ${user._id} (${clientIP})`);
        return next();
      }

      // Also check if it's a MasterAdmin (different model)
      if (decoded.type === 'master' || decoded.role === 'master_admin') {
        // Import dynamically to avoid circular dependency issues
        const MasterAdmin = (await import('../models/MasterAdmin.js')).default;
        const masterAdmin = await MasterAdmin.findById(decoded.id).select('_id');
        
        if (masterAdmin) {
          logger.info(`[IP Whitelist] 🔓 Bypass by Master Admin Token: ${masterAdmin._id} (${clientIP})`);
          return next();
        }
      }
    }

    // Return 404 to hide the existence of admin routes
    logger.warn(`[IP Whitelist] 🚫 BLOCKED admin access from: ${clientIP} (socket: ${socketIP}, normalized: ${normalizedIP}).`);
    return res.status(404).json({ message: 'Not Found' });
  } catch (error) {
    logger.error(`[IP Whitelist] ERROR: ${error.message}`);
    // On crash, fail closed (404/500)
    // Return explicit error in dev for debugging
    if (process.env.NODE_ENV === 'development') {
      return res.status(500).json({ message: 'Middleware Error', error: error.message, stack: error.stack });
    }
    return res.status(404).json({ message: 'Not Found' });
  }
};

// 2. Strict IP Whitelist (NO Bypass)
export const strictIpWhitelist = (req, res, next) => {
  try {
    const { isAllowed, clientIP, socketIP, normalizedIP } = checkIpAccess(req);

    req.isWhitelistedIP = isAllowed;

    if (isAllowed) {
      logger.debug(`[Strict IP] ✅ Allowed: ${clientIP} (socket: ${socketIP}, normalized: ${normalizedIP})`);
      return next();
    }

    logger.warn(`[Strict IP] 🚫 BLOCKED critical action from: ${clientIP} (socket: ${socketIP}, normalized: ${normalizedIP})`);
    return res.status(404).json({ message: 'Not Found' });
  } catch (error) {
    logger.error(`[Strict IP] ERROR: ${error.message}`);
    if (process.env.NODE_ENV === 'development') {
      return res.status(500).json({ message: 'Middleware Error', error: error.message, stack: error.stack });
    }
    return res.status(404).json({ message: 'Not Found' });
  }
};

export default ipWhitelist;
