import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true
  },
  deviceInfo: {
    browser: { type: String, default: 'Unknown' },
    browserVersion: { type: String, default: '' },
    os: { type: String, default: 'Unknown' },
    osVersion: { type: String, default: '' },
    device: { 
      type: String, 
      enum: ['Desktop', 'Mobile', 'Tablet', 'Unknown'], 
      default: 'Unknown' 
    },
    isMobile: { type: Boolean, default: false }
  },
  ipAddress: {
    type: String,
    required: true
  },
  location: {
    city: { type: String, default: '' },
    region: { type: String, default: '' },
    country: { type: String, default: '' },
    countryCode: { type: String, default: '' },
    timezone: { type: String, default: '' }
  },
  userAgent: {
    type: String,
    maxlength: 500,
    default: ''
  },
  lastActiveAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// TTL Index - Auto-delete expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for user queries
sessionSchema.index({ userId: 1, createdAt: -1 });

// Note: Use hashToken from sessionHelper.js for token operations
// Static method to find session by raw token (requires passing tokenHash)
sessionSchema.statics.findByTokenHash = async function(tokenHash) {
  return this.findOne({ tokenHash });
};

// Static method to get all sessions for a user
sessionSchema.statics.getUserSessions = async function(userId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

// Static method to terminate session by ID
sessionSchema.statics.terminateById = async function(sessionId, userId) {
  const session = await this.findOne({ _id: sessionId, userId });
  if (!session) {
    throw new Error('Session not found');
  }
  return session.deleteOne();
};

// Static method to terminate all sessions except current
sessionSchema.statics.terminateOthers = async function(userId, currentTokenHash) {
  return this.deleteMany({ 
    userId, 
    tokenHash: { $ne: currentTokenHash } 
  });
};

// Static method to terminate all sessions for a user
sessionSchema.statics.terminateAll = async function(userId) {
  return this.deleteMany({ userId });
};

// Static method to count user sessions
sessionSchema.statics.countUserSessions = async function(userId) {
  return this.countDocuments({ userId });
};

// Static method to get oldest session for a user
sessionSchema.statics.getOldestSession = async function(userId) {
  return this.findOne({ userId }).sort({ createdAt: 1 });
};

const Session = mongoose.model('Session', sessionSchema);

export default Session;
