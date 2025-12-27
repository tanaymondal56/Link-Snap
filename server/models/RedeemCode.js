import mongoose from 'mongoose';

const redeemCodeSchema = new mongoose.Schema({
  code: { 
    type: String, 
    unique: true, 
    index: true,
    required: true,
    uppercase: true,
    trim: true
  },
  tier: { 
    type: String, 
    enum: ['pro', 'business'], 
    required: true 
  },
  duration: { 
    type: String, 
    enum: ['1_month', '3_months', '6_months', '1_year', 'lifetime'], 
    required: true 
  },
  maxUses: { 
    type: Number, 
    default: 1,
    min: 1
  },
  usedCount: { 
    type: Number, 
    default: 0 
  },
  usedBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    usedAt: { type: Date, default: Date.now },
    snapId: String
  }],
  expiresAt: {
    type: Date,
    default: null // null = never expires
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Virtual to check if code is still valid
redeemCodeSchema.virtual('isValid').get(function() {
  if (!this.isActive) return false;
  if (this.usedCount >= this.maxUses) return false;
  if (this.expiresAt && new Date(this.expiresAt) < new Date()) return false;
  return true;
});

// Static method to generate a random code
redeemCodeSchema.statics.generateCode = function(tier, duration) {
  const tierPrefix = tier.toUpperCase().substring(0, 3); // PRO or BUS
  const durationMap = {
    '1_month': '1M',
    '3_months': '3M',
    '6_months': '6M',
    '1_year': '1Y',
    'lifetime': 'LT'
  };
  const durationCode = durationMap[duration] || 'XX';
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${tierPrefix}-${durationCode}-${random}`;
};

// Ensure virtuals are included in JSON output
redeemCodeSchema.set('toJSON', { virtuals: true });
redeemCodeSchema.set('toObject', { virtuals: true });

const RedeemCode = mongoose.model('RedeemCode', redeemCodeSchema);

export default RedeemCode;
