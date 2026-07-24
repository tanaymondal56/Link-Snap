/**
 * webhookController.js
 *
 * Handles incoming LemonSqueezy webhook HTTP requests.
 * 
 * Architecture:
 *  1. Verify HMAC signature (fast, constant-time)
 *  2. Enqueue job in BullMQ (fast, non-blocking)
 *  3. Return 200 immediately (well under LemonSqueezy's 50ms delivery timeout)
 *
 * Actual processing is done asynchronously in webhookProcessor.js via the BullMQ worker.
 * This file intentionally does NOT import processWebhookJob to avoid circular dependencies.
 */

import crypto from 'crypto';
import logger from '../utils/logger.js';
import { webhookQueue } from '../services/webhookQueueService.js';
import { processWebhookJob } from './webhookProcessor.js';

/**
 * Verify the HMAC-SHA256 signature from LemonSqueezy.
 * Uses timing-safe comparison to prevent timing attacks.
 * Docs: https://docs.lemonsqueezy.com/guides/developer-guide/webhooks#signing-requests
 */
const isValidSignature = (req) => {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('LEMONSQUEEZY_WEBHOOK_SECRET is not set');
    return false;
  }
  
  const rawSignature = req.headers['x-signature'];
  const signature = Array.isArray(rawSignature) ? rawSignature[0] : (rawSignature || '');
  
  if (!signature) {
    logger.error('Missing x-signature header');
    return false;
  }

  const rawBody = req.rawBody;
  
  if (!rawBody || (typeof rawBody !== 'string' && !Buffer.isBuffer(rawBody))) {
    logger.error('Missing or invalid rawBody for webhook signature verification. Ensure express.json verify callback is configured.');
    return false;
  }
  
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(rawBody).digest('hex');

  // To prevent timing variance, if the length doesn't match, we still do a comparison
  // against a dummy signature of the same length, but always return false.
  let sigBuffer;
  let isValidLength = true;
  if (digest.length !== signature.length) {
    logger.error(`Signature length mismatch. Expected: ${digest.length}, Got: ${signature.length}`);
    isValidLength = false;
    // Create a dummy buffer of the correct length to prevent timing attacks
    sigBuffer = Buffer.alloc(digest.length, '0', 'utf8');
  } else {
    sigBuffer = Buffer.from(signature, 'utf8');
  }
  
  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(digest, 'utf8'),
      sigBuffer
    );
    const finalResult = valid && isValidLength;
    if (!finalResult) {
      // Only log truncated prefix — never log the full HMAC digest (timing/replay risk)
      logger.error(`Signature mismatch. Computed[0:8]: ${digest.slice(0, 8)}..., Received[0:8]: ${signature.slice(0, 8)}...`);
    }
    return finalResult;
  } catch (err) {
    logger.error(`Signature verification error: ${err.message}`);
    return false;
  }
};

/**
 * POST /api/webhooks/lemon
 * Fail-fast webhook handler: verify signature → enqueue job → 200 ACK.
 */
export const handleWebhook = async (req, res) => {
  try {
    if (!isValidSignature(req)) {
       return res.status(401).json({ message: 'Invalid signature' });
    }
    
    if (!req.body || !req.body.meta) {
      logger.warn('[Webhook] Malformed webhook body received (missing meta).');
      return res.status(400).json({ error: 'Bad Request: Malformed payload' });
    }
    
    // Fail-fast ACK — respond immediately so LemonSqueezy doesn't retry unnecessarily
    res.status(200).json({ received: true });
    
    const { meta } = req.body;
    const eventName = meta.event_name;
    const customData = meta.custom_data || {};
    
    // Validate and sanitize the webhook ID to prevent injection attacks
    const rawWebhookId = req.headers['x-event-id'] || meta.id;
    const webhookId = (typeof rawWebhookId === 'string' && rawWebhookId.length <= 100) 
      ? String(rawWebhookId).trim() 
      : null;
      
    if (webhookId) {
        try {
            // Explicitly check connection to prevent BullMQ/ioredis offline queue from hanging indefinitely
            const client = await webhookQueue.client;
            if (!client || client.status !== 'ready') {
                throw new Error('BullMQ TCP client is not connected');
            }

            await webhookQueue.add('process_lemon_squeezy_webhook', {
                webhookId,
                eventName,
                customData,
                payload: req.body
            }, { jobId: webhookId });
            logger.info(`[Webhook] Enqueued ${eventName} with ID ${webhookId}`);
        } catch (queueErr) {
            logger.warn(`[Webhook] Queue unavailable (${queueErr.message}). Processing synchronously...`);
            
            // Artificial delay to prevent DB timing races for new user creation (simulating queue backoff)
            await new Promise(r => setTimeout(r, 2000));
            
            await processWebhookJob({
                webhookId,
                eventName,
                customData,
                payload: req.body
            });
        }
    } else {
        logger.warn('[Webhook] Invalid or missing webhook ID - could not enqueue');
    }
  } catch (error) {
    logger.error(`[Webhook Error] ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};
