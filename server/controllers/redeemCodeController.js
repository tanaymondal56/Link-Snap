import RedeemCode from '../models/RedeemCode.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';

/**
 * Generate a new redeem code (Admin only)
 * POST /api/admin/redeem-codes
 */
export const generateRedeemCode = async (req, res) => {
  try {
    const { tier, duration, maxUses = 1, expiresAt, notes, customCode } = req.body;
    
    // Validate inputs
    if (!tier || !['pro', 'business'].includes(tier)) {
      return res.status(400).json({ message: 'Invalid tier. Must be "pro" or "business".' });
    }
    
    if (!duration || !['1_month', '3_months', '6_months', '1_year', 'lifetime'].includes(duration)) {
      return res.status(400).json({ message: 'Invalid duration.' });
    }
    
    // Generate or use custom code
    let code = customCode?.toUpperCase().trim();
    if (!code) {
      code = RedeemCode.generateCode(tier, duration);
    }
    
    // Check if code already exists
    const existingCode = await RedeemCode.findOne({ code });
    if (existingCode) {
      return res.status(400).json({ message: 'This code already exists.' });
    }
    
    const redeemCode = await RedeemCode.create({
      code,
      tier,
      duration,
      maxUses: Math.max(1, parseInt(maxUses) || 1),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      notes,
      createdBy: req.user._id
    });
    
    logger.info(`[Redeem Code] Admin ${req.user.snapId} created code ${code} for ${tier}/${duration}`);
    
    res.status(201).json({
      message: 'Redeem code created successfully',
      code: redeemCode
    });
    
  } catch (error) {
    logger.error(`[Redeem Code Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to generate redeem code' });
  }
};

/**
 * List all redeem codes (Admin only)
 * GET /api/admin/redeem-codes
 */
export const listRedeemCodes = async (req, res) => {
  try {
    const { page = 1, limit = 20, active } = req.query;
    
    const query = {};
    if (active === 'true') query.isActive = true;
    if (active === 'false') query.isActive = false;
    
    const codes = await RedeemCode.find(query)
      .populate('createdBy', 'email snapId')
      // .sort({ createdAt: -1 }) // Disabled for Cosmos DB
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await RedeemCode.countDocuments(query);
    
    res.json({
      codes,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      total
    });
    
  } catch (error) {
    logger.error(`[Redeem Code Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to list redeem codes' });
  }
};

/**
 * Deactivate a redeem code (Admin only)
 * DELETE /api/admin/redeem-codes/:id
 */
export const deactivateRedeemCode = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid code ID format' });
    }
    
    const code = await RedeemCode.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    if (!code) {
      return res.status(404).json({ message: 'Code not found' });
    }
    
    logger.info(`[Redeem Code] Admin ${req.user.snapId} deactivated code ${code.code}`);
    
    res.json({ message: 'Code deactivated', code });
    
  } catch (error) {
    logger.error(`[Redeem Code Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to deactivate code' });
  }
};

/**
 * Redeem a code (User)
 * POST /api/subscription/redeem
 */
export const redeemCode = async (req, res) => {
  try {
    const { code } = req.body;
    const user = req.user;
    
    if (!code) {
      return res.status(400).json({ message: 'Code is required' });
    }
    
    const redeemCodeDoc = await RedeemCode.findOne({ 
      code: code.toUpperCase().trim() 
    });
    
    if (!redeemCodeDoc) {
      return res.status(404).json({ message: 'Invalid code' });
    }
    
    // Check if valid
    if (!redeemCodeDoc.isActive) {
      return res.status(400).json({ message: 'This code has been deactivated' });
    }
    
    if (redeemCodeDoc.usedCount >= redeemCodeDoc.maxUses) {
      return res.status(400).json({ message: 'This code has reached its usage limit' });
    }
    
    if (redeemCodeDoc.expiresAt && new Date(redeemCodeDoc.expiresAt) < new Date()) {
      return res.status(400).json({ message: 'This code has expired' });
    }
    
    // Check if user already used this code
    const alreadyUsed = redeemCodeDoc.usedBy.some(
      u => u.user.toString() === user._id.toString()
    );
    if (alreadyUsed) {
      return res.status(400).json({ message: 'You have already used this code' });
    }
    
    // Downgrade protection - prevent redeeming LOWER tier codes (same-tier is allowed for extension)
    const tierRank = { 'free': 0, 'pro': 1, 'business': 2 };
    const currentTier = user.subscription?.tier || 'free';
    if (tierRank[redeemCodeDoc.tier] < tierRank[currentTier]) {
      return res.status(400).json({ 
        message: `Cannot redeem a ${redeemCodeDoc.tier} code while on ${currentTier} plan. Contact support for assistance.` 
      });
    }
    
    // Calculate subscription end date based on duration
    const durationDays = {
      '1_month': 30,
      '3_months': 90,
      '6_months': 180,
      '1_year': 365,
      'lifetime': 36500 // ~100 years
    };
    
    const days = durationDays[redeemCodeDoc.duration] || 30;
    const now = new Date();
    
    // Store original subscription state for potential rollback
    const originalSubscription = user.subscription ? { ...user.subscription.toObject() } : null;
    
    // If user has existing active subscription, extend from current end date
    let startDate = now;
    if (user.subscription?.currentPeriodEnd && user.subscription.status === 'active') {
      const existingEnd = new Date(user.subscription.currentPeriodEnd);
      if (existingEnd > now) {
        startDate = existingEnd;
      }
    }
    const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
    
    // Update user subscription
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          'subscription.tier': redeemCodeDoc.tier,
          'subscription.status': 'active',
          'subscription.billingCycle': redeemCodeDoc.duration === 'lifetime' ? 'lifetime' : 'one_time',
          'subscription.currentPeriodStart': now,
          'subscription.currentPeriodEnd': endDate,
          'subscription.variantId': `REDEEM-${redeemCodeDoc.code}`,
          // Clear external subscription data to prevent confusion
          'subscription.subscriptionId': null,
          'subscription.customerPortalUrl': null,
          'subscription.updatePaymentUrl': null,
        }
      },
      { new: true }
    );
    
    // Update redeem code usage atomically with condition to prevent race
    const updateResult = await RedeemCode.findOneAndUpdate(
      {
        _id: redeemCodeDoc._id,
        usedCount: { $lt: redeemCodeDoc.maxUses } // Atomic check
      },
      {
        $inc: { usedCount: 1 },
        $push: { 
          usedBy: { 
            user: user._id, 
            usedAt: now,
            snapId: user.snapId 
          }
        }
      },
      { new: true }
    );
    
    // If no update happened, code was fully used between check and update
    if (!updateResult) {
      // Rollback: Restore user's ORIGINAL subscription state (not delete it!)
      if (originalSubscription) {
        await User.findByIdAndUpdate(user._id, { $set: { subscription: originalSubscription } });
      } else {
        // User had no subscription, reset to free
        await User.findByIdAndUpdate(user._id, { 
          $set: { 
            'subscription.tier': 'free',
            'subscription.status': 'active',
            'subscription.currentPeriodEnd': null
          } 
        });
      }
      return res.status(400).json({ message: 'This code has reached its usage limit' });
    }
    
    logger.info(`[Redeem Code] User ${user.snapId} redeemed code ${redeemCodeDoc.code} for ${redeemCodeDoc.tier}`);
    
    res.json({
      message: `Successfully upgraded to ${redeemCodeDoc.tier.toUpperCase()} plan!`,
      tier: redeemCodeDoc.tier,
      duration: redeemCodeDoc.duration,
      expiresAt: endDate
    });
    
  } catch (error) {
    logger.error(`[Redeem Code Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to redeem code' });
  }
};

/**
 * Get redeem code stats (Admin)
 * GET /api/admin/redeem-codes/stats
 */
export const getRedeemCodeStats = async (req, res) => {
  try {
    // Get all codes and calculate stats in JS (Cosmos DB has limited $expr support)
    const allCodes = await RedeemCode.find().select('isActive usedCount maxUses tier');
    
    const totalCodes = allCodes.length;
    const activeCodes = allCodes.filter(c => c.isActive && c.usedCount < c.maxUses).length;
    const totalRedemptions = allCodes.reduce((sum, c) => sum + (c.usedCount || 0), 0);
    
    // Calculate tier breakdown
    const tierMap = {};
    allCodes.forEach(c => {
      if (!tierMap[c.tier]) tierMap[c.tier] = { _id: c.tier, count: 0, used: 0 };
      tierMap[c.tier].count++;
      tierMap[c.tier].used += c.usedCount || 0;
    });
    
    res.json({
      totalCodes,
      activeCodes,
      totalRedemptions,
      byTier: Object.values(tierMap)
    });
    
  } catch (error) {
    logger.error(`[Redeem Code Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to get stats' });
  }
};
