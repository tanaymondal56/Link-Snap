import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { profileUpdateLimiter } from '../middleware/rateLimiter.js';
import { checkFeature } from '../middleware/subscriptionMiddleware.js';
import { 
  getPublicProfile, 
  getBioSettings, 
  updateBioSettings, 
  toggleBioVisibility 
} from '../controllers/bioController.js';

const router = express.Router();

// IMPORTANT: /me routes MUST come BEFORE /:username to avoid route collision
// Otherwise "me" would be treated as a username parameter

// Protected routes - Manage own bio (with rate limiting)
// Requires Pro or Business tier (bio_page feature)
router.get('/me', protect, checkFeature('bio_page'), getBioSettings);
router.put('/me', protect, checkFeature('bio_page'), profileUpdateLimiter, updateBioSettings);
router.patch('/me/toggle', protect, checkFeature('bio_page'), profileUpdateLimiter, toggleBioVisibility);

// Public route - Get user's bio page (MUST be last - catches all)
router.get('/:username', getPublicProfile);

export default router;

