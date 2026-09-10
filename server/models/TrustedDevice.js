import mongoose from 'mongoose';
import { isIPv4 } from '../utils/ipUtils.js';

const trustedDeviceSchema = new mongoose.Schema({
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  // WebAuthn Relying Party ID bound to this passkey
  rpId: {
    type: String,
    default: null,
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

  // WebAuthn Passkey metadata & backup flags
  credentialDeviceType: {
    type: String,
    enum: ['singleDevice', 'multiDevice'],
    default: 'singleDevice'
  },
  credentialBackedUp: {
    type: Boolean,
    default: false
  },
  aaguid: {
    type: String,
    default: null
  },

  // Transports (for WebAuthn - flexible string array for v14)
  transports: {
    type: [String],
    default: ['internal']
  }
}, {
  timestamps: true
});

// Indexes
trustedDeviceSchema.index({ userId: 1, isActive: 1 });
trustedDeviceSchema.index(
  { credentialId: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);
// Retention: Delete revoked devices 90 days after revocation
trustedDeviceSchema.index(
    { revokedAt: 1 }, 
    { 
        expireAfterSeconds: 90 * 24 * 60 * 60, 
        partialFilterExpression: { revokedAt: { $type: "date" } } 
    }
);

// Instance method to update last access, preferring IPv4
trustedDeviceSchema.methods.updateLastAccess = async function(ip, geo = {}) {
  if (ip && ip !== 'unknown') {
    const existingIsIPv4 = isIPv4(this.lastAccessIP);
    const currentIsIPv4 = isIPv4(ip);
    if (currentIsIPv4 || !existingIsIPv4) {
      this.lastAccessIP = ip;
    }
  }
  this.lastAccessGeo = {
    city: geo.city || this.lastAccessGeo?.city || 'Unknown',
    country: geo.country || this.lastAccessGeo?.country || 'Unknown',
    isp: geo.isp || this.lastAccessGeo?.isp || 'Unknown'
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
