import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/User.js';
import WebhookEvent from '../models/WebhookEvent.js';
import SubscriptionAuditLog from '../models/SubscriptionAuditLog.js';
import logger from '../utils/logger.js';
import NotificationService from '../services/notificationService.js';

// Verify the signature from Lemon Squeezy
// Docs: https://docs.lemonsqueezy.com/guides/developer-guide/webhooks#signing-requests
const isValidSignature = (req) => {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('LEMONSQUEEZY_WEBHOOK_SECRET is not set');
    return false;
  }
  
  const hmac = crypto.createHmac('sha256', secret);
  const rawBody = req.rawBody;
  
  if (!rawBody) {
    logger.error('Missing rawBody for webhook signature verification. Ensure express.json verify callback is configured.');
    return false;
  }
  
  const digest = hmac.update(rawBody).digest('hex');
  const signature = req.headers['x-signature'] || '';
  
  if (!signature) {
    logger.error('Missing x-signature header');
    return false;
  }

  // timingSafeEqual throws if lengths differ
  if (digest.length !== signature.length) {
    logger.error(`Signature length mismatch. Expected: ${digest.length}, Got: ${signature.length}`);
    return false;
  }
  
  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(digest, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
    if (!valid) {
      logger.error(`Signature mismatch. Computed: ${digest}, Received: ${signature}`);
    }
    return valid;
  } catch (err) {
    logger.error(`Signature verification error: ${err.message}`);
    return false;
  }
};

export const handleWebhook = async (req, res) => {
  try {
    // 1. Validate Signature
    if (!isValidSignature(req)) {
       // Log detailed error is now handled inside isValidSignature
       return res.status(401).json({ message: 'Invalid signature' });
    }
    
    // Valid signature confirmed.
    
    const { meta, data } = req.body;
    const eventName = meta.event_name;
    const customData = meta.custom_data || {};
    const userId = customData.user_id;
    const snapId = customData.snap_id; // Use Snap ID for robust lookup
    
    logger.info(`[Webhook] Received ${eventName} for User ${snapId || userId}`);

    // Extract and sanitize webhookId to prevent NoSQL injection
    const rawWebhookId = req.headers['x-event-id'] || meta.id;
    const webhookId = (typeof rawWebhookId === 'string' && rawWebhookId.length <= 100) 
      ? String(rawWebhookId).trim() 
      : null;
    
    if (!webhookId) {
      logger.warn('[Webhook] Invalid or missing webhook ID');
      return res.status(400).json({ message: 'Invalid webhook ID' });
    }

    // 2. Atomic Idempotency Check (Race-condition safe for Cosmos DB & MongoDB)
    // Uses findOneAndUpdate with upsert to atomically claim the event.
    // If the event already exists, we get the existing doc (wasFirstClaim = false).
    // If we created it, we get our new doc (wasFirstClaim = true).
    try {
      const claimResult = await WebhookEvent.findOneAndUpdate(
        { remoteId: webhookId },
        {
          $setOnInsert: {
            remoteId: webhookId,
            eventType: eventName,
            snapId: customData.snap_id || customData.user_id || 'PENDING',
            payload: req.body,
            status: 'pending', // Will be updated to 'processed' after success
            signature: req.headers['x-signature']
          }
        },
        { 
          upsert: true,           // Create if doesn't exist
          new: false,             // Return the OLD document (null if we created)
          rawResult: true         // Get full result with upsertedId for Cosmos DB
        }
      );

      // Check if this was a new insert (we claimed the event) or existing
      const wasAlreadyProcessed = claimResult.value && claimResult.value.status === 'processed';
      const wasCreatedByUs = claimResult.lastErrorObject?.upserted || !claimResult.value;
      
      if (wasAlreadyProcessed) {
        logger.info(`[Webhook] Duplicate event ${webhookId} already processed.`);
        return res.status(200).json({ message: 'Event already processed' });
      }
      
      if (!wasCreatedByUs && claimResult.value?.status === 'pending') {
        // Another request is currently processing this event
        logger.info(`[Webhook] Event ${webhookId} is being processed by another request.`);
        return res.status(200).json({ message: 'Event is being processed' });
      }
      
      // We successfully claimed this event - proceed with processing
      logger.info(`[Webhook] Claimed event ${webhookId} for processing.`);
      
    } catch (claimError) {
      // On Cosmos DB, duplicate key error means another request won the race
      if (claimError.code === 11000 || claimError.code === 16500) {
        logger.info(`[Webhook] Race condition caught for ${webhookId} - another request is processing.`);
        return res.status(200).json({ message: 'Event claimed by another request' });
      }
      throw claimError; // Re-throw unexpected errors
    }

    // 3. Find User (with input sanitization to prevent NoSQL injection)
    let user = null;
    
    // Validate SnapID format: must be string starting with 'SP-' and alphanumeric
    const isValidSnapId = (id) => {
      if (typeof id !== 'string') return false;
      if (!id.startsWith('SP-')) return false;
      // Only allow alphanumeric and hyphens, max 50 chars
      return /^SP-[A-Za-z0-9-]{1,47}$/.test(id);
    };

    if (snapId && isValidSnapId(snapId)) {
       user = await User.findOne({ snapId: String(snapId) });
    } else if (userId) {
       if (typeof userId === 'string' && isValidSnapId(userId)) {
          logger.info(`[Webhook] userId looks like SnapID: ${userId}. Searching by snapId.`);
          user = await User.findOne({ snapId: String(userId) });
       } else if (typeof userId === 'string' && mongoose.isValidObjectId(userId)) {
          // findById with explicit string conversion
          user = await User.findById(String(userId));
       } else {
          logger.warn(`[Webhook] Invalid userId format: ${userId}. Skipping lookup to prevent crash.`);
       }
    } else if (data.attributes.user_email) {
       // Sanitize email to prevent NoSQL injection
       // Only allow string values, strip any operators or objects
       const rawEmail = data.attributes.user_email;
       if (typeof rawEmail === 'string' && rawEmail.length <= 254) {
         // Normalize email and ensure it's a plain string (no $ operators)
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

    // If user not found, log fail-lookup but don't crash
    if (!user) {
        logger.error(`[Webhook] User not found for event ${eventName}. SnapID: ${snapId}`);
        await WebhookEvent.updateOne(
            { remoteId: webhookId },
            { 
              $set: { 
                status: 'failed', 
                error: 'User not found in database',
                snapId: snapId || 'UNKNOWN'
              } 
            }
        );
        return res.status(200).json({ message: 'User not found, event logged.' });
    }

    // 4. Process Event
    const attributes = data.attributes;
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
    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
      case 'subscription_resumed':
      case 'subscription_payment_success':
      case 'subscription_unpaused': // Treated same as resume
        user.subscription = {
            ...user.subscription,
            customerId: attributes.customer_id.toString(),
            subscriptionId: attributes.subscription_id?.toString() || data.id,
            variantId: variantId || user.subscription.variantId, // Keep existing if update doesn't have it
            tier: tier !== 'free' ? tier : user.subscription.tier, // Don't overwrite with free if mapping fails/missing
            billingCycle: cycle,
            status: attributes.status, // active, on_trial
            currentPeriodStart: new Date(attributes.renews_at || attributes.created_at), 
            currentPeriodEnd: new Date(attributes.renews_at || attributes.ends_at),
            updatePaymentUrl: attributes.urls?.update_payment_method,
            customerPortalUrl: attributes.urls?.customer_portal,
            cancelledAt: null,
        };
        
        if (attributes.status === 'active' && user.subscription.status === 'on_trial') {
            user.hasUsedTrial = true;
        }

        // Notify Admin: New Subscription
        if (eventName === 'subscription_created') {
            NotificationService.subscriptionCreated(user._id, user.email, tier).catch(err => {
                 logger.error(`[Webhook] Failed to send sub created notification: ${err.message}`);
            });
        }
        break;

        case 'subscription_cancelled':
        user.subscription.status = attributes.status; // 'cancelled'
        user.subscription.cancelledAt = new Date(attributes.cancelled_at || Date.now());
        user.subscription.currentPeriodEnd = new Date(attributes.ends_at);

        // Notify Admin: Subscription Cancelled
        NotificationService.subscriptionCancelled(user._id, user.email, user.subscription.tier, 'User cancelled via portal').catch(err => {
             logger.error(`[Webhook] Failed to send sub cancelled notification: ${err.message}`);
        });
        break;
        
      case 'subscription_paused':
        user.subscription.status = 'paused';
        // Paused usually means immediate access revamp or effective until end?
        // LS usually keeps access until period end, but status changes to paused.
        // We will trust the status.
        user.subscription.currentPeriodEnd = new Date(attributes.ends_at || Date.now());
        break;
        
      case 'subscription_expired':
        user.subscription.status = 'expired';
        user.subscription.tier = 'free';
        break;
        
      case 'subscription_payment_failed':
         user.subscription.status = 'past_due';
         logger.warn(`[Webhook] Payment failed for ${user.snapId}. Grace period active.`);
         
         // Notify Admin: Payment Failed (Critical)
         NotificationService.paymentFailed(user._id, user.email, 'Subscription', 'Payment declied/failed').catch(err => {
              logger.error(`[Webhook] Failed to send payment failed notification: ${err.message}`);
         });
         break;

      default:
        logger.info(`[Webhook] Unhandled event type: ${eventName}`);
        // Log event but don't save user as nothing was modified
        await WebhookEvent.updateOne(
            { remoteId: webhookId },
            { $set: { status: 'ignored', snapId: user.snapId } }
        );
        return res.status(200).json({ received: true, ignored: true });
    }

    await user.save();
    
    // Map event names to audit actions
    const actionMap = {
      'subscription_created': 'created',
      'subscription_updated': 'updated',
      'subscription_resumed': 'resumed',
      'subscription_payment_success': 'updated',
      'subscription_unpaused': 'resumed',
      'subscription_cancelled': 'cancelled',
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
          tier: user.subscription?.tier,
          status: user.subscription?.status,
          subscriptionId: user.subscription?.subscriptionId,
          customerId: user.subscription?.customerId,
          variantId: user.subscription?.variantId,
          currentPeriodStart: user.subscription?.currentPeriodStart,
          currentPeriodEnd: user.subscription?.currentPeriodEnd,
          billingCycle: user.subscription?.billingCycle,
          cancelledAt: user.subscription?.cancelledAt
        },
        webhookEvent: {
          eventName: eventName,
          eventId: webhookId
        }
      });
    } catch (auditErr) {
      // Don't fail the webhook if audit logging fails
      logger.error(`[Webhook Audit Log Error] ${auditErr.message}`);
    }
    
    // 5. Mark event as processed (update the pending claim)
    await WebhookEvent.updateOne(
        { remoteId: webhookId },
        { $set: { status: 'processed', snapId: user.snapId } }
    );

    res.status(200).json({ received: true });

  } catch (error) {
    logger.error(`[Webhook Error] ${error.message}`);
    // Return 500 to Lemon Squeezy to trigger retry
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
