import express from 'express';
import { handleWebhook } from '../controllers/webhookController.js';
import { handleRazorpayWebhook } from '../controllers/razorpayWebhookController.js';
import { webhookLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Dynamic rate limiting:
//   - Known payment provider IPs (WEBHOOK_TRUSTED_IPS env): permissive (1000/min)
//   - All other sources: strict (5/min) to prevent CPU-exhaustion DoS attacks
router.use(webhookLimiter);

router.post('/', handleWebhook);
router.post('/razorpay', handleRazorpayWebhook);

export default router;
