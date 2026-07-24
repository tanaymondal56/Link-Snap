/**
 * webhookQueueService.js
 *
 * Defines the BullMQ Queue and Worker for async LemonSqueezy webhook processing.
 *
 * IMPORTANT: This module imports processWebhookJob from webhookProcessor.js (NOT webhookController.js)
 * to avoid the circular dependency: webhookController → webhookQueueService → webhookController
 *
 * Redis connection: BullMQ requires a native TCP Redis connection (it uses BLPOP/Lua scripts).
 * It is NOT compatible with Upstash HTTP REST API.
 * In production (K8s), ensure REDIS_URL or REDIS_HOST/REDIS_PORT/REDIS_PASSWORD are set.
 */

import { Queue, Worker } from 'bullmq';
import logger from '../utils/logger.js';
import WebhookEvent from '../models/WebhookEvent.js';
import { processWebhookJob } from '../controllers/webhookProcessor.js';

/**
 * Build a BullMQ-compatible Redis connection config.
 * Priority: REDIS_URL (full URL) → REDIS_HOST/PORT/PASSWORD → localhost fallback.
 * TLS is automatically enabled for managed Redis providers (Upstash TCP, Redis Cloud, etc.)
 */
const getRedisConnectionOptions = () => {
  let baseOptions = {};

  if (process.env.REDIS_URL) {
    try {
      const u = new URL(process.env.REDIS_URL);
      baseOptions = {
        host: u.hostname,
        port: parseInt(u.port, 10) || 6379,
        password: u.password || undefined,
        // Enable TLS for rediss:// protocol (managed Redis with TLS)
        tls: u.protocol === 'rediss:' ? {} : undefined,
      };
    } catch (e) {
      logger.error(`[WebhookQueue] Invalid REDIS_URL: ${e.message}. Falling back to host/port.`);
    }
  }

  // K8s local Redis sidecar or explicit host/port config fallback
  if (!Object.keys(baseOptions).length) {
      baseOptions = {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
      };
  }

  // Ensure network resilience for OCI blips via ioredis retry strategy
  return {
      ...baseOptions,
      maxRetriesPerRequest: null, // Required by BullMQ
      retryStrategy: (times) => {
          const delay = Math.min(times * 200, 5000); // Exponential backoff up to 5s
          logger.warn(`[WebhookQueue] Redis disconnected. Retrying in ${delay}ms...`);
          return delay;
      },
      reconnectOnError: (err) => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
              return true; // Reconnect on replica failovers
          }
          return false;
      }
  };
};

const connectionOptions = getRedisConnectionOptions();

// Define the Queue
export const webhookQueue = new Queue('webhookProcessingQueue', {
    connection: connectionOptions,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000 // 2s, 4s, 8s — gives DB time to settle for new user timing races
        },
        removeOnComplete: {
            age: 24 * 3600, // Keep successful jobs for 24 hours
            count: 100      // Keep up to 100 successful jobs
        },
        // Auto-prune failed jobs to prevent Redis memory exhaustion
        removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days for debugging
            count: 1000          // Never keep more than 1000 failed jobs
        }
    }
});

// Create a Worker to process the jobs
export const webhookWorker = new Worker('webhookProcessingQueue', async (job) => {
    try {
        await processWebhookJob(job.data);
        return { success: true };
    } catch (error) {
        logger.error(`[WebhookWorker] Job ${job.id} (${job.data.eventName}) failed: ${error.message}`);
        
        // Mark event as failed in DB so we can track it
        // (on retry BullMQ will re-process and transition back to 'pending' via the idempotency logic)
        await WebhookEvent.findOneAndUpdate(
            { remoteId: job.data.webhookId },
            { $set: { status: 'failed', processedAt: new Date(), error: error.message } }
        ).catch(dbErr => logger.error(`[WebhookWorker] DB update error: ${dbErr.message}`));
        
        throw error; // Re-throw so BullMQ handles retries with backoff
    }
}, {
    connection: connectionOptions,
    concurrency: 5 // Process 5 webhooks concurrently
});

webhookWorker.on('completed', job => {
    logger.info(`[WebhookWorker] Job ${job.id} (${job.data?.eventName}) completed successfully`);
});

webhookWorker.on('failed', (job, err) => {
    logger.error(`[WebhookWorker] Job ${job?.id} (${job?.data?.eventName}) permanently failed: ${err.message}`);
});

webhookWorker.on('error', err => {
    logger.error(`[WebhookWorker] Worker error: ${err.message}`);
});
