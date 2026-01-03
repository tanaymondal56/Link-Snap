import User from '../models/User.js';
import RedeemCode from '../models/RedeemCode.js';
import logger from '../utils/logger.js';

/**
 * Dev: Upgrade own account to Pro
 * POST /api/dev/subscription/upgrade
 */
export const devUpgradeSelf = async (req, res) => {
  try {
    const user = req.user;
    
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          'subscription.tier': 'pro',
          'subscription.status': 'active',
          'subscription.currentPeriodStart': new Date(),
          'subscription.currentPeriodEnd': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          'subscription.variantId': 'DEV-OVERRIDE',
          'subscription.billingCycle': 'monthly'
        }
      },
      { new: true }
    ).select('-password');

    logger.info(`[DEV] User ${user.email} self-upgraded to PRO via DevTools`);
    
    res.json({ message: 'Dev Mode: Upgraded to Pro', user: updatedUser });
  } catch (error) {
    logger.error(`[Dev Upgrade Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to upgrade' });
  }
};

export const devResetSelf = async (req, res) => {
  try {
    const user = req.user;
    const keepHistory = req.query.keepHistory === 'true';
    
    // 1. Clear user from any Redeem Codes they used ONLY if keepHistory is false
    if (!keepHistory) {
        const codesUsed = await RedeemCode.find({ 'usedBy.user': user._id });
        
        if (codesUsed.length > 0) {
        for (const code of codesUsed) {
            await RedeemCode.findByIdAndUpdate(code._id, {
            $pull: { usedBy: { user: user._id } },
            $inc: { usedCount: -1 }
            });
        }
        logger.info(`[DEV] Cleared ${codesUsed.length} redeem code usages for user ${user.email}`);
        }
    } else {
        logger.info(`[DEV] User ${user.email} reset subscription but KEPT redeem history`);
    }

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          'subscription.tier': 'free',
          'subscription.status': 'active',
          'subscription.currentPeriodEnd': null,
          'subscription.subscriptionId': null,
          'subscription.variantId': null,
          'subscription.billingCycle': null
        }
      },
      { new: true }
    ).select('-password');

    logger.info(`[DEV] User ${user.email} self-reset to FREE via DevTools`);
    
    res.json({ message: 'Dev Mode: Reset to Free', user: updatedUser });
  } catch (error) {
    logger.error(`[Dev Reset Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to reset' });
  }
};

/**
 * Dev: Clear Redeem History ONLY (Keep Tier)
 * POST /api/dev/subscription/clear-history
 */
export const devClearRedeemHistory = async (req, res) => {
  try {
    const user = req.user;
    
    const codesUsed = await RedeemCode.find({ 'usedBy.user': user._id });
    
    if (codesUsed.length > 0) {
      for (const code of codesUsed) {
        await RedeemCode.findByIdAndUpdate(code._id, {
          $pull: { usedBy: { user: user._id } },
          $inc: { usedCount: -1 }
        });
      }
      logger.info(`[DEV] Cleared ${codesUsed.length} redeem code usages for user ${user.email} (Tier preserved)`);
      return res.json({ message: `Dev Mode: Cleared history for ${codesUsed.length} codes. You can reuse them now.`, count: codesUsed.length });
    }
    
    res.json({ message: 'Dev Mode: No redemption history found to clear.' });
  } catch (error) {
    logger.error(`[Dev History Clear Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to clear history' });
  }
};
