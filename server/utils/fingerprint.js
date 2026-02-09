import crypto from 'crypto';
import { getUserIP } from '../middleware/strictProxyGate.js';

/**
 * Generates a fingerprint for anonymous users based on IP and User-Agent.
 * This helps distinguish users behind the same NAT (e.g., corporate/school networks)
 * who have different browsers/devices.
 * 
 * @param {Object} req - Express request object
 * @returns {string} Fingerprint string (IP:UA_HASH)
 */
export const getAnonFingerprint = (req) => {
    // Get real user IP using proxy-aware extraction
    const ip = getUserIP(req);
    
    // Hash the User-Agent to keep the fingerprint short
    // Using SHA-256 for better collision resistance than MD5
    const ua = req.headers['user-agent'] || '';
    const uaHash = crypto.createHash('sha256').update(ua).digest('hex').slice(0, 16); // 16 chars is plenty
    
    return `${ip}:${uaHash}`;
};
