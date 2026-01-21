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
    count: { type: Number, default: 0 },      // Active links (decreases on delete)
    hardCount: { type: Number, default: 0 },  // Total created this period (never decreases)
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
  verificationToken: { type: String, select: false },
  verificationTokenExpires: { type: Date, select: false },
  otp: {
    type: String,
    select: false, // Hide by default
  },
  otpExpires: {
    type: Date,
    select: false,
  },
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false },
  resetPasswordOtp: { type: String, select: false },
  resetPasswordOtpExpires: { type: Date, select: false },
  refreshTokens: {
    type: [String],
    select: false
  },
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

// Performance Indexes
// Index for sorting by creation date (admin panel)
userSchema.index({ createdAt: -1 });
// Index for subscription tier filtering
userSchema.index({ 'subscription.tier': 1, createdAt: -1 });
// Index for role filtering  
userSchema.index({ role: 1, createdAt: -1 });
// Index for ban scheduler (finding expired bans)
userSchema.index({ isActive: 1, bannedUntil: 1 });
// Text index for admin search (weighted by relevance)
userSchema.index(
  { email: 'text', username: 'text', firstName: 'text', lastName: 'text' },
  { 
    weights: { email: 10, username: 5, firstName: 2, lastName: 2 },
    name: 'user_search_text_index'
  }
);


const User = mongoose.model('User', userSchema);

export default User;
