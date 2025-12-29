import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 8, // Matches Zod validator requirement
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 30,
    match: [/^[a-z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and dashes'],
    index: true,
  },
  usernameChangedAt: {
    type: Date,
    default: null,  // null = never changed, can change anytime
  },
  // Elite Badge (e.g. pioneer-VII) - Status/Gamification
  eliteId: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
    immutable: true,
  },
  // Snap ID (e.g. SP-2025-W8K2P) - Technical/Support
  snapId: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
    immutable: true,
  },

  // Elite ID tier (pioneer, torchbearer, dreamer, believer, wave, admin)
  idTier: {
    type: String,
    enum: ['admin', 'pioneer', 'torchbearer', 'dreamer', 'believer', 'wave'],
    immutable: true,
  },
  idNumber: {
    type: Number,
    immutable: true,
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: 50,
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: 50,
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 20,
  },
  company: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  website: {
    type: String,
    trim: true,
    maxlength: 200,
  },
  bio: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  avatar: {
    type: String,
    trim: true,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  
  // Link-in-Bio Page Settings
  bioPage: {
    isEnabled: { type: Boolean, default: false }, // Off by default (requires Pro to enable)
    displayName: { type: String, maxlength: 50, trim: true },
    bio: { type: String, maxlength: 160, trim: true }, // SEO-friendly length
    avatarUrl: { type: String, trim: true },
    theme: { 
      type: String, 
      enum: ['default', 'dark', 'midnight', 'ocean', 'forest', 'sunset', 'custom'],
      default: 'default' 
    },
    customTheme: {
      background: String,
      textColor: String,
      buttonColor: String,
      buttonTextColor: String,
      buttonStyle: { type: String, enum: ['rounded', 'pill', 'square'], default: 'rounded' }
    },
    socials: {
      twitter: { type: String, trim: true },
      instagram: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      youtube: { type: String, trim: true },
      github: { type: String, trim: true },
      tiktok: { type: String, trim: true },
      discord: { type: String, trim: true },
      email: { type: String, trim: true },
      website: { type: String, trim: true }
    },
    pinnedLinks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Url' }],
    lastUpdatedAt: { type: Date, default: Date.now }
  },
  
  // Subscription & Billing
  subscription: {
    customerId: { type: String, index: true }, // lemon_squeezy_customer_id
    subscriptionId: { type: String, index: true }, // lemon_squeezy_subscription_id
    variantId: String, // lemon_squeezy_variant_id
    tier: { 
      type: String, 
      enum: ['free', 'pro', 'business'], 
      default: 'free' 
    },
    billingCycle: { type: String, enum: ['monthly', 'yearly', 'lifetime', 'one_time', null] },
    status: { 
      type: String, 
      enum: ['active', 'on_trial', 'past_due', 'paused', 'cancelled', 'expired', 'unpaid'],
      default: 'active' 
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    trialEndsAt: Date,
    cancelledAt: Date,
    customerPortalUrl: String,
    updatePaymentUrl: String,
  },
  
  // Usage Tracking
  linkUsage: {
    count: { type: Number, default: 0 },
    resetAt: { type: Date, default: Date.now }
  },
  clickUsage: {
    count: { type: Number, default: 0 },
    resetAt: { type: Date, default: Date.now }
  },
  hasUsedTrial: { type: Boolean, default: false },
  disableLinksOnBan: {
    type: Boolean,
    default: true, // When banned, links are disabled by default
  },
  bannedAt: {
    type: Date,
    default: null,
  },
  bannedReason: {
    type: String,
    trim: true,
    maxlength: 500,
    default: null,
  },
  bannedUntil: {
    type: Date,
    default: null,
  },
  bannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  otp: {
    type: String,
    select: true, // Include by default in queries
  },
  otpExpires: {
    type: Date,
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  resetPasswordOtp: String,
  resetPasswordOtpExpires: Date,
  refreshTokens: [{
    type: String,
  }],
  lastLoginAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.lastName || '';
});

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  
  try {
    // Use 12 salt rounds (OWASP minimum recommendation for security)
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    // Critical: If encryption fails, DO NOT save the user.
    // Propagate error to abort the save operation.
    throw new Error('Password encryption failed: ' + error.message);
  }
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
