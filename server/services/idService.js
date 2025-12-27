import Counter from '../models/Counter.js';

/**
 * Elite ID Service
 * Generates unique, tiered IDs for users based on their join order and role
 */

// Roman numeral conversion for first 10 users
const toRoman = (num) => {
  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  if (num >= 1 && num <= 10) {
    return romanNumerals[num - 1];
  }
  return num.toString();
};

// Tier definitions with cutoffs
const TIER_CONFIG = {
  admin: { name: 'admin', prefix: 'root', color: '#DC2626', icon: '👑' },
  pioneer: { name: 'pioneer', prefix: 'pioneer', maxSeq: 10, color: '#F59E0B', icon: '☀️' },
  torchbearer: { name: 'torchbearer', prefix: 'torch', maxSeq: 50, color: '#EA580C', icon: '🔥' },
  dreamer: { name: 'dreamer', prefix: 'dreamer', maxSeq: 200, color: '#8B5CF6', icon: '✨' },
  believer: { name: 'believer', prefix: 'believer', maxSeq: 1000, color: '#EAB308', icon: '⭐' },
  wave: { name: 'wave', prefix: 'wave', maxSeq: Infinity, color: '#0EA5E9', icon: '🌊' }
};

// Tier messages for UI tooltips
const TIER_MESSAGES = {
  admin: 'Core builder of this platform',
  pioneer: 'You believed before anyone else',
  torchbearer: 'You carried the flame forward',
  dreamer: 'You saw the vision early',
  believer: 'You joined when we were a whisper',
  wave: "You're part of the movement now"
};

/**
 * Determine user tier based on sequence number
 */
const determineTier = (seqNum) => {
  if (seqNum <= 10) return 'pioneer';
  if (seqNum <= 50) return 'torchbearer';
  if (seqNum <= 200) return 'dreamer';
  if (seqNum <= 1000) return 'believer';
  return 'wave';
};

import { generateSnapId } from '../utils/snapIdGenerator.js';

// ... (existing imports/constants)

/**
 * Generate User Identity (Elite ID + Snap ID)
 * This replaces the old generateEliteId
 * @param {boolean} isAdmin - Whether user is an admin
 * @returns {Promise<{eliteId: string, snapId: string, idTier: string, idNumber: number}>}
 */
export const generateUserIdentity = async (isAdmin = false) => {
  // 1. Generate Elite ID (Badge)
  let eliteId, idTier, idNumber;
  
  if (isAdmin) {
    const seq = await Counter.getNextSequence('admin');
    eliteId = `root-${seq}`;
    idTier = 'admin';
    idNumber = seq;
  } else {
    const seq = await Counter.getNextSequence('user');
    const tier = determineTier(seq);
    const tierConfig = TIER_CONFIG[tier];
    idNumber = seq;
    idTier = tier;

    if (tier === 'pioneer') {
      eliteId = `${tierConfig.prefix}-${toRoman(seq)}`;
    } else {
      eliteId = `${tierConfig.prefix}-${seq}`;
    }
  }

  // 2. Generate Snap ID (System ID)
  // Get global sequence for unique hash
  const snapSeq = await Counter.getNextSequence('snap');
  const snapId = generateSnapId(snapSeq, new Date());

  return {
    eliteId,
    snapId,
    idTier,
    idNumber
  };
};



/**
 * Get tier configuration for display
 */
export const getTierConfig = (tier) => {
  return TIER_CONFIG[tier] || TIER_CONFIG.wave;
};

/**
 * Get tier message for tooltips
 */
export const getTierMessage = (tier) => {
  return TIER_MESSAGES[tier] || TIER_MESSAGES.wave;
};

/**
 * Generate ID for existing user (migration)
 * @param {number} userSeq - User sequence number  
 * @param {boolean} isAdmin - Whether user is admin
 * @param {number} adminSeq - Admin sequence number (if admin)
 */
export const generateIdForMigration = (userSeq, isAdmin, adminSeq = null) => {
  if (isAdmin && adminSeq) {
    return {
      internalId: `root-${adminSeq}`,
      idTier: 'admin',
      idNumber: adminSeq
    };
  }

  const tier = determineTier(userSeq);
  const tierConfig = TIER_CONFIG[tier];

  let internalId;
  if (tier === 'pioneer') {
    internalId = `${tierConfig.prefix}-${toRoman(userSeq)}`;
  } else {
    internalId = `${tierConfig.prefix}-${userSeq}`;
  }

  return {
    internalId,
    idTier: tier,
    idNumber: userSeq
  };
};

export { TIER_CONFIG, TIER_MESSAGES, determineTier, toRoman };
