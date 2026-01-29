import RedeemCode from '../models/RedeemCode.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';
import { calculateSubscriptionEndDate } from '../utils/dateUtils.js';

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
      .sort({ createdAt: -1 })
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
 * Update a redeem code (Admin only)
 * PUT /api/admin/redeem-codes/:id
 */
export const updateRedeemCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { tier, duration, maxUses, expiresAt, notes, code: newCode, isActive } = req.body;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid code ID format' });
    }

    const updates = {};
    if (tier) updates.tier = tier;
    if (duration) updates.duration = duration;
    if (maxUses) updates.maxUses = parseInt(maxUses);
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (notes !== undefined) updates.notes = notes;
    if (isActive !== undefined) updates.isActive = isActive;

    const existingCode = await RedeemCode.findById(id);
    if (!existingCode) {
      return res.status(404).json({ message: 'Code not found' });
    }

    // Handle code string update check
    if (newCode && newCode !== existingCode.code) {
      const duplicate = await RedeemCode.findOne({ code: newCode.toUpperCase().trim() });
      if (duplicate) return res.status(400).json({ message: 'Code already exists' });
      updates.code = newCode.toUpperCase().trim();
    }

    const updatedCode = await RedeemCode.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    logger.info(`[Redeem Code] Admin ${req.user.snapId} updated code ${updatedCode.code}`);

    res.json({ message: 'Code updated successfully', code: updatedCode });

  } catch (error) {
    logger.error(`[Redeem Code Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to update code' });
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

    // Determine timing variables
    const now = new Date();

    // Determine action type BEFORE any updates
    const isUpgrade = tierRank[redeemCodeDoc.tier] > tierRank[currentTier];
    const actionType = isUpgrade ? 'upgrade' : 'extend';

    // ═══════════════════════════════════════════════════════════════════════════════
    // RACE CONDITION FIX: Claim code ATOMICALLY FIRST, then upgrade user
    // This ensures only one user can claim the last use of a code
    // Cosmos DB compatible: uses findOneAndUpdate with atomic $inc
    // ═══════════════════════════════════════════════════════════════════════════════

    // Step 1: ATOMICALLY claim the code (check limits + increment in one operation)
    const claimResult = await RedeemCode.findOneAndUpdate(
      {
        _id: redeemCodeDoc._id,
        isActive: true,
        usedCount: { $lt: redeemCodeDoc.maxUses },  // Atomic limit check
        // Ensure user hasn't already redeemed (Cosmos DB compatible array check)
        'usedBy.user': { $ne: user._id }
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

    // If claim failed, code was fully used or user already redeemed
    if (!claimResult) {
      // Re-check to give specific error message
      const recheckCode = await RedeemCode.findById(redeemCodeDoc._id);
      if (recheckCode?.usedBy.some(u => u.user.toString() === user._id.toString())) {
        return res.status(400).json({ message: 'You have already used this code' });
      }
      return res.status(400).json({ message: 'This code has reached its usage limit' });
    }

    // Step 2: Code successfully claimed - now safely upgrade user subscription
    // Calculate dates for subscription
    let startDate = now;
    if (user.subscription?.currentPeriodEnd && user.subscription.status === 'active') {
      const existingEnd = new Date(user.subscription.currentPeriodEnd);
      if (existingEnd > now) {
        startDate = existingEnd;
      }
    }
    const endDate = calculateSubscriptionEndDate(startDate, redeemCodeDoc.duration);

    // Update user subscription (safe - code is already claimed)
    await User.findByIdAndUpdate(
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

    // Code was already claimed in Step 1, no rollback needed
    // This is the correct order: claim first, then upgrade
    // If user upgrade fails (extremely rare), they still have the code claim
    // which is the correct behavior (admin can manually assist if needed)

    logger.info(`[Redeem Code] User ${user.snapId} redeemed code ${redeemCodeDoc.code} for ${redeemCodeDoc.tier}`);

    res.json({
      message: isUpgrade
        ? `Successfully upgraded to ${redeemCodeDoc.tier.toUpperCase()} plan!`
        : `Subscription extended successfully!`,
      tier: redeemCodeDoc.tier,
      duration: redeemCodeDoc.duration,
      expiresAt: endDate,
      action: actionType
    });

  } catch (error) {
    logger.error(`[Redeem Code Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to redeem code' });
  }
};

/**
 * Validate code and get preview details (User)
 * POST /api/subscription/redeem/validate
 */
export const validateRedeemCode = async (req, res) => {
  try {
    const { code } = req.body;
    const user = req.user;

    if (!code) return res.status(400).json({ message: 'Code is required' });

    const redeemCodeDoc = await RedeemCode.findOne({
      code: code.toUpperCase().trim()
    });

    if (!redeemCodeDoc) return res.status(404).json({ message: 'Invalid code' });
    if (!redeemCodeDoc.isActive) return res.status(400).json({ message: 'Code deactivated' });
    if (redeemCodeDoc.usedCount >= redeemCodeDoc.maxUses) return res.status(400).json({ message: 'Code fully used' });
    if (redeemCodeDoc.expiresAt && new Date(redeemCodeDoc.expiresAt) < new Date()) return res.status(400).json({ message: 'Code expired' });

    // Check usage
    if (redeemCodeDoc.usedBy.some(u => u.user.toString() === user._id.toString())) {
      return res.status(400).json({ message: 'You have already used this code' });
    }

    // Helper for calendar-based addition (Shared utility)
    const calculateEndDate = calculateSubscriptionEndDate;

    const now = new Date();
    let startDate = now;
    if (user.subscription?.currentPeriodEnd && user.subscription.status === 'active') {
      const existingEnd = new Date(user.subscription.currentPeriodEnd);
      if (existingEnd > now) startDate = existingEnd;
    }

    const newExpiry = calculateEndDate(startDate, redeemCodeDoc.duration);

    const currentTier = user.subscription?.tier || 'free';
    const currentExpiry = user.subscription?.currentPeriodEnd || null;

    res.json({
      valid: true,
      code: redeemCodeDoc.code,
      tier: redeemCodeDoc.tier,
      duration: redeemCodeDoc.duration,
      current: {
        tier: currentTier,
        expiresAt: currentExpiry
      },
      future: {
        tier: redeemCodeDoc.tier,
        expiresAt: newExpiry,
        startsAt: startDate
      },
      warning: currentTier !== 'free' && currentTier !== redeemCodeDoc.tier ?
        `Switching from ${currentTier} to ${redeemCodeDoc.tier} will adjust your plan immediately.` : null
    });

  } catch (error) {
    logger.error(`[Validate Code Error] ${error.message}`);
    res.status(500).json({ message: 'Validation failed' });
  }
};

/**
 * Get redeem code stats (Admin)
 * GET /api/admin/redeem-codes/stats
 */
export const getRedeemCodeStats = async (req, res) => {
  try {
    // Optimized Stats (DB-level counting)
    const [totalCodes, activeCodesResult, totalRedemptionsResult, tierMetadata] = await Promise.all([
      RedeemCode.countDocuments(),
      RedeemCode.countDocuments({
        isActive: true,
        $expr: { $lt: ["$usedCount", "$maxUses"] }
      }),
      RedeemCode.aggregate([
        { $group: { _id: null, total: { $sum: "$usedCount" } } }
      ]),
      RedeemCode.aggregate([
        {
          $group: {
            _id: "$tier",
            count: { $sum: 1 },
            used: { $sum: "$usedCount" }
          }
        }
      ])
    ]);

    const activeCodes = activeCodesResult;
    const totalRedemptions = totalRedemptionsResult[0]?.total || 0;
    const byTier = tierMetadata.map(t => ({
      _id: t._id,
      count: t.count,
      used: t.used
    }));

    res.json({
      totalCodes,
      activeCodes,
      totalRedemptions,
      byTier
    });

  } catch (error) {
    logger.error(`[Redeem Code Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to get stats' });
  }
};
