import crypto from 'crypto';

/**
 * Generates a fingerprint for anonymous users based on IP and User-Agent.
 * This helps distinguish users behind the same NAT (e.g., corporate/school networks)
 * who have different browsers/devices.
 * 
 * @param {Object} req - Express request object
 * @returns {string} Fingerprint string (IP:UA_HASH)
 */
export const getAnonFingerprint = (req) => {
    // Get IP address (trust proxy should be enabled in app.js if behind Nginx/Cloudflare)
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Hash the User-Agent to keep the fingerprint short
    const ua = req.headers['user-agent'] || '';
    const uaHash = crypto.createHash('md5').update(ua).digest('hex').slice(0, 8);
    
    return `${ip}:${uaHash}`;
};
