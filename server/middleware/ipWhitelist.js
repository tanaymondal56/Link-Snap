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

export const ipWhitelist = (req, res, next) => {
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

  // Set the flag on the request object
  req.isWhitelistedIP = isAllowed;

  if (isAllowed) {
    console.log(`[IP Whitelist] ✅ Allowed: ${clientIP} (socket: ${socketIP}, normalized: ${normalizedIP})`);
    return next();
  }

  // Return 404 to hide the existence of admin routes
  console.warn(`[IP Whitelist] 🚫 BLOCKED admin access from: ${clientIP} (socket: ${socketIP}, normalized: ${normalizedIP}). Whitelist: ${JSON.stringify(allowedIPs)}`);
  return res.status(404).json({ message: 'Not Found' });
};

export default ipWhitelist;
