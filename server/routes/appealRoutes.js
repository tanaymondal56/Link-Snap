import express from 'express';
import { submitAppeal, checkAppealStatus } from '../controllers/appealController.js';
import { appealLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public routes for banned users
router.post('/', appealLimiter, submitAppeal);
router.get('/status', appealLimiter, checkAppealStatus);

export default router;
