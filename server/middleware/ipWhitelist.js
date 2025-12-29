import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// IP Whitelist Middleware for Admin Panel Protection
// Only localhost is allowed by default. Add trusted IPs to .env
const envAllowedIPs = process.env.ADMIN_WHITELIST_IPS ? process.env.ADMIN_WHITELIST_IPS.split(',').map(ip => ip.trim()) : [];

const allowedIPs = [
  ...envAllowedIPs
];

// Debug: Print allowed IPs on startup (only once)
console.log('🛡️ [Security Config] Admin Whitelist:', allowedIPs);

// Localhost IP patterns (these are always allowed)
const localhostPatterns = [
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
];

// Helper: Check IP Logic
const checkIpAccess = (req) => {
  // Get the actual connection IP (not from headers - can't be spoofed)
  const socketIP = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  const normalizedSocketIP = socketIP.replace(/^::ffff:/, '');

  // Check if request is coming from a trusted proxy (localhost)
  const isFromTrustedProxy = localhostPatterns.includes(socketIP) ||
    localhostPatterns.includes(normalizedSocketIP) ||
    normalizedSocketIP === '127.0.0.1' ||
    normalizedSocketIP.startsWith('127.');

  // Get client IP from headers (only trust if from a proxy)
  let clientIP;
  if (isFromTrustedProxy) {
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
      console.log(`[IP Whitelist] ✅ Allowed: ${clientIP} (socket: ${socketIP}, normalized: ${normalizedIP})`);
      return next();
    }

    // === BYPASS: Check for valid Admin Token ===
    if (req.headers.authorization?.startsWith('Bearer')) {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      
      const user = await User.findById(decoded.id).select('role isActive');
      
      if (user && user.role === 'admin' && user.isActive) {
        console.log(`[IP Whitelist] 🔓 Bypass by Admin Token: ${user._id} (${clientIP})`);
        return next();
      }
    }

    // Return 404 to hide the existence of admin routes
    console.warn(`[IP Whitelist] 🚫 BLOCKED admin access from: ${clientIP} (socket: ${socketIP}, normalized: ${normalizedIP}).`);
    return res.status(404).json({ message: 'Not Found' });
  } catch (error) {
    console.error('[IP Whitelist] ERROR:', error);
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
      console.log(`[Strict IP] ✅ Allowed: ${clientIP} (socket: ${socketIP}, normalized: ${normalizedIP})`);
      return next();
    }

    console.warn(`[Strict IP] 🚫 BLOCKED critical action from: ${clientIP} (socket: ${socketIP}, normalized: ${normalizedIP})`);
    return res.status(404).json({ message: 'Not Found' });
  } catch (error) {
    console.error('[Strict IP] ERROR:', error);
    if (process.env.NODE_ENV === 'development') {
       return res.status(500).json({ message: 'Middleware Error', error: error.message, stack: error.stack });
    }
    return res.status(404).json({ message: 'Not Found' });
  }
};

export default ipWhitelist;
