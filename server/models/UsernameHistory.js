import mongoose from 'mongoose';

const usernameHistorySchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  // Permanent internal ID for audit trail (survives user deletion)
  userInternalId: {
    type: String,
    index: true
  },
  previousUsername: { 
    type: String, 
    required: true,
    lowercase: true,
    trim: true
  },
  newUsername: { 
    type: String, 
    required: true,
    lowercase: true,
    trim: true
  },
  changedAt: { 
    type: Date, 
    default: Date.now
  },
  changedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null  // null = self-initiated change
  },
  reason: { 
    type: String, 
    maxlength: 200,
    trim: true
  }
}, { 
  timestamps: true 
});

// Compound index for efficient user history queries
usernameHistorySchema.index({ userId: 1, changedAt: -1 });
// Lookup index: Check who owned a username previously
usernameHistorySchema.index({ previousUsername: 1, changedAt: -1 });
// Retention: Keep history for 3 years (legal/dispute window)
usernameHistorySchema.index({ changedAt: 1 }, { expireAfterSeconds: 3 * 365 * 24 * 60 * 60 });

export default mongoose.model('UsernameHistory', usernameHistorySchema);
