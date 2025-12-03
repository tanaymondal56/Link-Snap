import express from 'express';
import { getUrlAnalytics } from '../controllers/analyticsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protected route to get analytics for a specific URL
router.get('/:shortId', protect, getUrlAnalytics);

export default router;
