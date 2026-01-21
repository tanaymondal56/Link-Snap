import mongoose from 'mongoose';

const trustedDeviceSchema = new mongoose.Schema({
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // WebAuthn credentials
  credentialId: {
    type: Buffer,
    required: true
  },
  publicKey: {
    type: Buffer,
    required: true
  },
  counter: {
    type: Number,
    default: 0
  },

  // Device information
  deviceName: {
    type: String,
    default: 'Unknown Device',
    maxlength: 50
  },
  deviceModel: {
    type: String,
    default: 'Unknown'
  },
  deviceOS: {
    type: String,
    default: 'Unknown'
  },
  browser: {
    type: String,
    default: 'Unknown'
  },

  // IP tracking
  registeredIP: {
    type: String,
    required: true
  },
  registeredGeo: {
    city: { type: String, default: 'Unknown' },
    country: { type: String, default: 'Unknown' },
    isp: { type: String, default: 'Unknown' }
  },
  lastAccessIP: {
    type: String,
    default: null
  },
  lastAccessGeo: {
    city: { type: String, default: 'Unknown' },
    country: { type: String, default: 'Unknown' },
    isp: { type: String, default: 'Unknown' }
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  revokedAt: {
    type: Date,
    default: null
  },
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Transports (for WebAuthn)
  transports: [{
    type: String,
    enum: ['usb', 'ble', 'nfc', 'internal', 'hybrid']
  }]
}, {
  timestamps: true
});

// Indexes
trustedDeviceSchema.index({ userId: 1, isActive: 1 });
trustedDeviceSchema.index({ credentialId: 1 }, { unique: true });
// Retention: Delete revoked devices 90 days after revocation
trustedDeviceSchema.index(
    { revokedAt: 1 }, 
    { 
        expireAfterSeconds: 90 * 24 * 60 * 60, 
        partialFilterExpression: { revokedAt: { $type: "date" } } 
    }
);

// Instance method to update last access
trustedDeviceSchema.methods.updateLastAccess = async function(ip, geo = {}) {
  this.lastAccessIP = ip;
  this.lastAccessGeo = {
    city: geo.city || 'Unknown',
    country: geo.country || 'Unknown',
    isp: geo.isp || 'Unknown'
  };
  this.updatedAt = new Date();
  await this.save();
};

// Static method to get active devices for a user
trustedDeviceSchema.statics.getActiveDevices = function(userId) {
  return this.find({ userId, isActive: true });
};

// Static method to revoke a device
trustedDeviceSchema.statics.revokeDevice = async function(deviceId, revokedByUserId) {
  return this.findByIdAndUpdate(deviceId, {
    isActive: false,
    revokedAt: new Date(),
    revokedBy: revokedByUserId
  });
};

// Static method to revoke all devices for a user
trustedDeviceSchema.statics.revokeAllDevices = async function(userId, revokedByUserId) {
  return this.updateMany(
    { userId, isActive: true },
    {
      isActive: false,
      revokedAt: new Date(),
      revokedBy: revokedByUserId
    }
  );
};

const TrustedDevice = mongoose.model('TrustedDevice', trustedDeviceSchema);

export default TrustedDevice;
