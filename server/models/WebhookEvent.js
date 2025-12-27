import mongoose from 'mongoose';

const webhookEventSchema = new mongoose.Schema({
  // The unique ID from Lemon Squeezy (used for idempotency)
  remoteId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  
  // The type of event (e.g. 'subscription_created', 'subscription_updated')
  eventType: {
    type: String,
    required: true,
    index: true,
  },
  
  // Snap ID of the user related to this event (for easy lookup)
  snapId: {
    type: String,
    required: true,
    index: true,
  },
  
  // The full raw payload for debugging
  payload: {
    type: Object,
    required: true,
  },
  
  // Processing status
  status: {
    type: String,
    enum: ['processed', 'failed', 'pending'],
    default: 'processed',
  },
  
  // Error message if processing failed
  error: {
    type: String,
  },
  
  // Metadata from header (signature, etc.)
  signature: String,
  
}, {
  timestamps: true,
});

// Auto-delete processed logs after 90 days to save space
// Keep failed ones longer? No, 90 days is enough for audit usually.
webhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);

export default WebhookEvent;
