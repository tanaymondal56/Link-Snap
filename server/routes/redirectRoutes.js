import express from 'express';
import { redirectUrl, previewUrl } from '../controllers/redirectController.js';
import { redirectLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Preview page routes (when user adds + at the end)
// Using regex pattern to match shortId followed by +
router.get(/^\/([a-zA-Z0-9_-]+)\+$/, redirectLimiter, previewUrl);

// Regular redirect route (also handles trailing slash via Express normalization)
router.get('/:shortId', redirectLimiter, redirectUrl);

export default router;
