import express from 'express';
import { handleWebhook } from '../controllers/webhookController.js';

const router = express.Router();

// Webhook endpoint
// Critical: We need the raw body for signature verification.
// The raw body middleware should be applied here or in index.js specifically for this route.
// If index.js applies global express.json(), it might consume the stream.
// Strategy: We will handle raw body parsing in index.js for this specific path OR
// assume index.js is updated to capture raw body.
// For now, simple route definition.

router.post('/', handleWebhook);

export default router;
