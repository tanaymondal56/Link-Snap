import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';
import { ipWhitelist, strictIpWhitelist } from '../middleware/ipWhitelist.js';
import {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
  getDevices,
  updateDeviceName,
  revokeDevice,
  revokeAllDevices,
} from '../controllers/deviceAuthController.js';

const router = express.Router();

// ============================================
// HIDDEN DEVICE AUTH ROUTES
// Using obscure path /.d/ instead of /device/
// ============================================

// PUBLIC: Get authentication challenge (no auth required)
// This is called BEFORE login to start biometric flow
router.post('/challenge', getAuthenticationOptions);

// PUBLIC: Verify biometric authentication
// This validates the biometric response
router.post('/verify', verifyAuthentication);

// ============================================
// PROTECTED: Require IP whitelist + auth + admin
// These are for device management in admin panel
// ============================================

// Get registration options (requires STRICT whitelisted IP)
// Registration must happen physically from a secure location
router.post('/register/options', strictIpWhitelist, verifyToken, verifyAdmin, getRegistrationOptions);

// Complete registration (requires STRICT whitelisted IP)
router.post('/register/verify', strictIpWhitelist, verifyToken, verifyAdmin, verifyRegistration);

// Get all devices for current user
// Uses standard whitelist (allows remote access if biometrically matched)
router.get('/devices', ipWhitelist, verifyToken, verifyAdmin, getDevices);

// Update device name (Remote OK)
router.patch('/devices/:deviceId', ipWhitelist, verifyToken, verifyAdmin, updateDeviceName);

// Revoke a specific device (Remote OK - Allows killing lost devices remotely)
router.delete('/devices/:deviceId', ipWhitelist, verifyToken, verifyAdmin, revokeDevice);

// Revoke all devices (Remote OK - Emergency)
router.delete('/devices', ipWhitelist, verifyToken, verifyAdmin, revokeAllDevices);

export default router;
