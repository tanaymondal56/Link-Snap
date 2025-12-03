// IP Whitelist Middleware for Admin Panel Protection
// Add your trusted IPs here

const allowedIPs = [
  // Localhost variations
  '::1',
  '::ffff:127.0.0.1',
  '127.0.0.1',
  'localhost',

  // Add your public IPs below (uncomment and replace):
  // '103.xxx.xxx.xxx',    // Home IP
  // '192.168.1.100',      // Office IP
  // '10.0.0.50',          // VPN IP
];

export const ipWhitelist = (req, res, next) => {
  // Get client IP (handles proxies)
  const clientIP = req.ip ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress;

  // Check if it's localhost (various formats)
  const isLocalhost = !clientIP ||
    clientIP === '::1' ||
    clientIP === '::ffff:127.0.0.1' ||
    clientIP.includes('127.0.0.1') ||
    clientIP.includes('localhost');

  const isAllowed = isLocalhost || allowedIPs.some(ip => {
    if (!clientIP) return false;
    return clientIP === ip || clientIP.includes(ip);
  });

  // Set the flag on the request object
  req.isWhitelistedIP = isAllowed;

  console.log(`[IP Whitelist] IP: ${clientIP}, Allowed: ${isAllowed}`);

  if (isAllowed) {
    return next();
  }

  // Return 404 to hide the existence of admin routes
  console.warn(`[IP BLOCKED] Attempted admin access from: ${clientIP}`);
  return res.status(404).json({ message: 'Not Found' });
}; export default ipWhitelist;
