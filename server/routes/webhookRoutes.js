import express from 'express';
import { handleWebhook } from '../controllers/webhookController.js';
import { handleRazorpayWebhook } from '../controllers/razorpayWebhookController.js';

const router = express.Router();

router.post('/', handleWebhook);
router.post('/razorpay', handleRazorpayWebhook);

export default router;
