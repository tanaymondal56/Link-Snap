/**
 * webhookProcessor.js
 *
 * Contains the core LemonSqueezy webhook event processing logic.
 * Extracted from webhookController.js to break the circular dependency:
 *   webhookController → webhookQueueService → webhookProcessor (not webhookController)
 *
 * This module is imported by webhookQueueService (worker) to execute jobs.
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import WebhookEvent from '../models/WebhookEvent.js';
import SubscriptionAuditLog from '../models/SubscriptionAuditLog.js';
import logger from '../utils/logger.js';
import NotificationService from '../services/notificationService.js';
import { invalidateUserAnalyticsCache } from './analyticsController.js';
import { redisDel } from '../config/redis.js';

/**
 * Process a LemonSqueezy webhook job from the BullMQ queue.
 * Called by the webhookWorker in webhookQueueService.js.
 *
 * If the user is not found and this might be a timing issue (new user registration),
 * this function THROWS so BullMQ can retry with exponential backoff.
 */
export const processWebhookJob = async (jobData) => {
  const { webhookId, eventName, customData, payload } = jobData;
  const snapId = customData.snap_id;
  const userId = customData.user_id;
  const data = payload.data;

  try {
    logger.info(`[Webhook] Processing ${eventName} for User ${snapId || userId}`);

    // 1. Atomic Idempotency Check (BullMQ retry-safe)
    try {
      const claimResult = await WebhookEvent.findOneAndUpdate(
        { remoteId: webhookId },
        {
          $setOnInsert: {
            remoteId: webhookId,
            eventType: eventName,
            snapId: snapId || userId || 'PENDING',
            payload: payload,
            status: 'pending',
            signature: 'enqueued_valid',
          }
        },
        { upsert: true, new: false, rawResult: true }
      );

      // If it existed (value is not null)
      if (claimResult.value) {
        if (claimResult.value.status === 'processed') {
          logger.info(`[Webhook] Duplicate event ${webhookId} already processed.`);
          return;
        }
        // It was pending or failed. We are retrying it.
        await WebhookEvent.updateOne({ remoteId: webhookId }, { $set: { status: 'pending' } });
      }

      logger.info(`[Webhook] Claimed event ${webhookId} for processing.`);

    } catch (claimError) {
      // On Cosmos DB, duplicate key error means another concurrent job won the race
      if (claimError.code === 11000 || claimError.code === 16500) {
        logger.info(`[Webhook] Race condition caught for ${webhookId} - another request is processing.`);
        return;
      }
      throw claimError;
    }

    // 2. Find User (with input sanitization to prevent NoSQL injection)
    let user = null;
    
    // Validate SnapID format: must be string starting with 'SP-' and alphanumeric
    const isValidSnapId = (id) => {
      if (typeof id !== 'string') return false;
      if (!id.startsWith('SP-')) return false;
      return /^SP-[A-Za-z0-9-]{1,47}$/.test(id);
    };

    if (snapId && isValidSnapId(snapId)) {
       user = await User.findOne({ snapId: String(snapId) });
    } else if (userId) {
       if (typeof userId === 'string' && isValidSnapId(userId)) {
          logger.info(`[Webhook] userId looks like SnapID: ${userId}. Searching by snapId.`);
          user = await User.findOne({ snapId: String(userId) });
       } else if (typeof userId === 'string' && mongoose.isValidObjectId(userId)) {
          user = await User.findById(String(userId));
       } else {
          logger.warn(`[Webhook] Invalid userId format: ${userId}. Skipping lookup.`);
       }
    } else if (data?.attributes?.user_email) {
       // Sanitize email to prevent NoSQL injection
       const rawEmail = data.attributes.user_email;
       if (typeof rawEmail === 'string' && rawEmail.length <= 254) {
         const sanitizedEmail = rawEmail.toLowerCase().trim();
         if (/^[^\s@$]+@[^\s@$]+\.[^\s@$]+$/.test(sanitizedEmail)) {
           user = await User.findOne({ email: sanitizedEmail });
         } else {
           logger.warn(`[Webhook] Invalid email format: ${rawEmail}. Skipping lookup.`);
         }
       } else {
         logger.warn(`[Webhook] Invalid email type or length. Skipping lookup.`);
       }
    }

    // If user not found, THROW to trigger BullMQ retry (handles timing race on new registrations)
    if (!user) {
      logger.error(`[Webhook] User not found for event ${eventName}. SnapID: ${snapId}`);
      await WebhookEvent.updateOne(
          { remoteId: webhookId },
          { $set: { status: 'failed', error: 'User not found in database', snapId: snapId || 'UNKNOWN' } }
      );
      // Throw to let BullMQ retry — the user may not have been created yet (timing race)
      throw new Error(`User not found for webhookId=${webhookId} event=${eventName} snapId=${snapId}`);
    }

    // 3. CRITICAL: Gateway guard — never let a LemonSqueezy webhook overwrite a Razorpay subscription.
    if (user.subscription?.gateway === 'razorpay' && !['cancelled', 'expired'].includes(user.subscription.status)) {
      logger.warn(`[Webhook] Ignoring LS event "${eventName}" for Razorpay user ${user.snapId}. Gateway conflict prevented.`);
      await WebhookEvent.updateOne(
        { remoteId: webhookId },
        { $set: { status: 'ignored', snapId: user.snapId, error: 'Gateway conflict: user is on razorpay gateway' } }
      );
      return;
    }

    const attributes = data.attributes;
    
    // Check out-of-order execution / stale webhooks
    const webhookTimestamp = new Date(attributes.updated_at || attributes.created_at || Date.now());
    if (user.subscription?.lastWebhookTimestamp && webhookTimestamp < user.subscription.lastWebhookTimestamp) {
        logger.warn(`[Webhook] Discarding stale webhook ${webhookId} (${webhookTimestamp}) for user ${user.snapId}`);
        await WebhookEvent.updateOne({ remoteId: webhookId }, { $set: { status: 'ignored', error: 'Stale webhook' } });
        return;
    }
    const variantId = attributes.variant_id?.toString();
    
    // Map Variant ID to Tier (if present)
    let tier = 'free';
    let cycle = 'monthly';
    
    if (variantId === process.env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID) {
        tier = 'pro';
        cycle = 'monthly';
    } else if (variantId === process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID) {
        tier = 'pro';
        cycle = 'yearly';
    } else if (variantId === process.env.LEMONSQUEEZY_PRO_ONETIME_VARIANT_ID) {
        tier = 'pro';
        cycle = 'one_time';
    }
    
    // Store previous subscription state BEFORE any modifications
    const previousSubscription = {
      tier: user.subscription?.tier,
      status: user.subscription?.status,
      subscriptionId: user.subscription?.subscriptionId,
      customerId: user.subscription?.customerId,
      variantId: user.subscription?.variantId,
      currentPeriodStart: user.subscription?.currentPeriodStart,
      currentPeriodEnd: user.subscription?.currentPeriodEnd,
      billingCycle: user.subscription?.billingCycle,
      cancelledAt: user.subscription?.cancelledAt
    };
    
    // Update Logic
    const setQuery = {};

    switch (eventName) {
      case 'order_created':                  // LS event for one-time purchases
      case 'subscription_created':
      case 'subscription_updated':
      case 'subscription_resumed':
      case 'subscription_payment_recovered': // LS event for recovered failed payments
      case 'subscription_renewed':           // LS event for successful recurring billing
      case 'subscription_unpaused':          // Treated same as resume
        {
          const wasOnTrial = user.subscription?.status === 'on_trial';

          Object.assign(setQuery, {
              'subscription.gateway': 'lemonsqueezy',
              'subscription.customerId': attributes.customer_id?.toString(),
              'subscription.subscriptionId': attributes.subscription_id?.toString() || (data.type === 'subscriptions' ? data.id?.toString() : user.subscription?.subscriptionId),
              'subscription.variantId': variantId || user.subscription?.variantId,
              'subscription.tier': tier !== 'free' ? tier : (user.subscription?.tier || 'free'),
              'subscription.billingCycle': cycle,
              'subscription.status': attributes.status === 'paid' ? 'active' : (attributes.status || 'active'),
              'subscription.currentPeriodStart': new Date(attributes.created_at),
              'subscription.currentPeriodEnd': cycle === 'one_time' 
                  ? new Date(new Date(attributes.created_at).setMonth(new Date(attributes.created_at).getMonth() + 1))
                  : new Date(attributes.renews_at || attributes.ends_at),
              'subscription.updatePaymentUrl': attributes.urls?.update_payment_method,
              'subscription.customerPortalUrl': attributes.urls?.customer_portal,
              'subscription.cancelledAt': null,
              'subscription.lastWebhookTimestamp': webhookTimestamp,
          });
          
          if (attributes.status === 'active' && wasOnTrial) {
              setQuery['hasUsedTrial'] = true;
          }

          if (eventName === 'subscription_created') {
              await NotificationService.subscriptionCreated(user._id, user.email, tier).catch(err => {
                   logger.error(`[Webhook] Failed to send sub created notification: ${err.message}`);
              });
          }
          break;
        }

      case 'order_refunded':
      case 'subscription_cancelled':
        Object.assign(setQuery, {
            'subscription.status': 'cancelled',
            'subscription.cancelledAt': new Date(attributes.cancelled_at || attributes.updated_at || Date.now()),
            'subscription.currentPeriodEnd': new Date(attributes.ends_at || Date.now()),
            'subscription.lastWebhookTimestamp': webhookTimestamp,
        });

        await NotificationService.subscriptionCancelled(user._id, user.email, setQuery['subscription.tier'] || user.subscription?.tier || 'free', 'User cancelled via portal').catch(err => {
             logger.error(`[Webhook] Failed to send sub cancelled notification: ${err.message}`);
        });
        break;
        
      case 'subscription_paused':
        Object.assign(setQuery, {
            'subscription.status': 'paused',
            'subscription.currentPeriodEnd': new Date(attributes.ends_at || Date.now()),
            'subscription.lastWebhookTimestamp': webhookTimestamp,
        });
        break;
        
      case 'subscription_expired':
        Object.assign(setQuery, {
            'subscription.status': 'expired',
            'subscription.tier': 'free',
            'subscription.lastWebhookTimestamp': webhookTimestamp,
        });
        break;
        
      case 'subscription_payment_failed':
         Object.assign(setQuery, {
             'subscription.status': 'past_due',
             'subscription.lastWebhookTimestamp': webhookTimestamp,
         });
         logger.warn(`[Webhook] Payment failed for ${user.snapId}. Grace period active.`);
         
         await NotificationService.paymentFailed(user._id, user.email, 'Subscription', 'Payment declined/failed').catch(err => {
              logger.error(`[Webhook] Failed to send payment failed notification: ${err.message}`);
         });
         break;

      default:
        logger.info(`[Webhook] Unhandled event type: ${eventName}`);
        await WebhookEvent.updateOne(
            { remoteId: webhookId },
            { $set: { status: 'ignored', snapId: user.snapId } }
        );
        return;
    }

    // Atomically update user, preventing older webhooks from overwriting newer ones
    const updateResult = await User.updateOne(
        { 
          _id: user._id,
          $or: [
            { 'subscription.lastWebhookTimestamp': { $lt: webhookTimestamp } },
            { 'subscription.lastWebhookTimestamp': null },
            { 'subscription.lastWebhookTimestamp': { $exists: false } }
          ]
        },
        { $set: setQuery }
    );

    if (updateResult.modifiedCount === 0) {
        logger.warn(`[Webhook] Concurrency prevention: Webhook ${webhookId} was superseded by a newer concurrent webhook for user ${user.snapId}`);
        await WebhookEvent.updateOne({ remoteId: webhookId }, { $set: { status: 'ignored', error: 'Superseded by newer concurrent webhook' } });
        return;
    }
    
    // Invalidate analytics and user cache if tier changed
    const newTier = setQuery['subscription.tier'];
    if (newTier && previousSubscription.tier !== newTier) {
        await invalidateUserAnalyticsCache(user._id);
    }
    await redisDel(`ls:user:${user._id}`);
    
    // Map event names to audit actions
    const actionMap = {
      'order_created': 'created',
      'subscription_created': 'created',
      'subscription_updated': 'updated',
      'subscription_resumed': 'resumed',
      'subscription_renewed': 'updated',
      'subscription_payment_recovered': 'updated',
      'subscription_unpaused': 'resumed',
      'subscription_cancelled': 'cancelled',
      'order_refunded': 'cancelled',
      'subscription_paused': 'paused',
      'subscription_expired': 'expired',
      'subscription_payment_failed': 'updated'
    };
    
    // Create audit log for subscription changes
    try {
      await SubscriptionAuditLog.create({
        userId: user._id,
        userEmail: user.email,
        userSnapId: user.snapId,
        action: actionMap[eventName] || 'updated',
        source: 'webhook',
        reason: `Webhook event: ${eventName}`,
        previousData: previousSubscription,
        newData: {
          tier: setQuery['subscription.tier'] || user.subscription?.tier,
          status: setQuery['subscription.status'] || user.subscription?.status,
          subscriptionId: setQuery['subscription.subscriptionId'] || user.subscription?.subscriptionId,
          customerId: setQuery['subscription.customerId'] || user.subscription?.customerId,
          variantId: setQuery['subscription.variantId'] || user.subscription?.variantId,
          currentPeriodStart: setQuery['subscription.currentPeriodStart'] || user.subscription?.currentPeriodStart,
          currentPeriodEnd: setQuery['subscription.currentPeriodEnd'] || user.subscription?.currentPeriodEnd,
          billingCycle: setQuery['subscription.billingCycle'] || user.subscription?.billingCycle,
          cancelledAt: setQuery['subscription.cancelledAt'] || user.subscription?.cancelledAt
        },
        webhookEvent: {
          eventName: eventName,
          eventId: webhookId
        }
      });
    } catch (auditErr) {
      logger.error(`[Webhook Audit Log Error] ${auditErr.message}`);
    }
    
    // Mark event as processed
    await WebhookEvent.updateOne(
        { remoteId: webhookId },
        { $set: { status: 'processed', snapId: user.snapId } }
    );

  } catch (error) {
    logger.error(`[Webhook Error] ${error.message}`);
    throw error; // Re-throw so BullMQ worker can handle retry/fail logic
  }
};
