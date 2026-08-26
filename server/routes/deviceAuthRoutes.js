import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';
import { ipWhitelist, strictIpWhitelist } from '../middleware/ipWhitelist.js';
import { biometricAuthLimiter } from '../middleware/rateLimiter.js';
import { dualLayerAuthActionLimiter } from '../middleware/dualLayerAuthRateLimiter.js';
import {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
  getVerificationOptions,
  verifyPasskey,
  getDevices,
  updateDeviceName,
  revokeDevice,
  revokeAllDevices,
} from '../controllers/deviceAuthController.js';

// Middleware to block Master Admin from using biometric features
const blockMasterAdmin = (req, res, next) => {
  if (req.user?.role === 'master_admin') {
    return res.status(403).json({ 
      message: 'Biometric/Device authentication is disabled for Master Admin accounts for security reasons.' 
    });
  }
  next();
};

const router = express.Router();

// ============================================
// HIDDEN DEVICE AUTH ROUTES
// Using obscure path /.d/ instead of /device/
// ============================================

// PUBLIC: Get authentication challenge (no auth required)
// This is called BEFORE login to start biometric flow
router.post('/challenge', biometricAuthLimiter, getAuthenticationOptions);

// PUBLIC: Verify biometric authentication
// This validates the biometric response
router.post('/verify', biometricAuthLimiter, dualLayerAuthActionLimiter, verifyAuthentication);

// ============================================
// PROTECTED: Require IP whitelist + auth + admin
// These are for device management in admin panel
// ============================================

// Get registration options (requires STRICT whitelisted IP)
// Registration must happen physically from a secure location
router.post('/register/options', strictIpWhitelist, verifyToken, verifyAdmin, blockMasterAdmin, getRegistrationOptions);

// Complete registration (requires STRICT whitelisted IP)
router.post('/register/verify', strictIpWhitelist, verifyToken, verifyAdmin, blockMasterAdmin, verifyRegistration);

// Get all devices for current user
// Uses standard whitelist (allows remote access if biometrically matched)
router.get('/devices', ipWhitelist, verifyToken, verifyAdmin, blockMasterAdmin, getDevices);

// Update device name (Remote OK)
router.patch('/devices/:deviceId', ipWhitelist, verifyToken, verifyAdmin, blockMasterAdmin, updateDeviceName);

// Revoke a specific device (Remote OK - Allows killing lost devices remotely)
router.delete('/devices/:deviceId', ipWhitelist, verifyToken, verifyAdmin, blockMasterAdmin, revokeDevice);

// Revoke all devices (Remote OK - Emergency)
router.delete('/devices', ipWhitelist, verifyToken, verifyAdmin, blockMasterAdmin, revokeAllDevices);

// ============================================
// PASSKEY HEALTH-CHECK (authenticated, NO session created)
// Lets a logged-in admin prove their passkey still exists & validates.
// ============================================

// Challenge scoped to the current user's active credentials
router.post('/verify-passkey/options', ipWhitelist, verifyToken, verifyAdmin, blockMasterAdmin, biometricAuthLimiter, getVerificationOptions);

// Verify the assertion — counter + lastAccess updated, no tokens issued
router.post('/verify-passkey', ipWhitelist, verifyToken, verifyAdmin, blockMasterAdmin, biometricAuthLimiter, dualLayerAuthActionLimiter, verifyPasskey);

export default router;
