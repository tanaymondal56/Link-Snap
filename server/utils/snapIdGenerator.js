import Sqids from 'sqids';

// Initialize Sqids with a custom alphabet for readability (no ambiguous chars)
// Removing I, L, O, 0, 1 from standard alphabet to prevent confusion
const sqids = new Sqids({
  alphabet: '23456789ABCDEFGHJKMNPQRSTUVWXYZ',
  minLength: 5,
});

/**
 * Get Season Code (Quarter + Month in Quarter)
 * @param {Date} date - Date object
 * @returns {string} e.g. "A1" (Jan), "B2" (May)
 */
const getSeasonCode = (date) => {
  const month = date.getMonth(); // 0-11
  
  // Quarter: 0-2=A, 3-5=B, 6-8=C, 9-11=D
  const quarterIndex = Math.floor(month / 3);
  const quarterChar = String.fromCharCode(65 + quarterIndex); // A, B, C, D
  
  // Month within quarter: 1, 2, 3
  const monthInQuarter = (month % 3) + 1;
  
  return `${quarterChar}${monthInQuarter}`;
};

/**
 * Generate Smart Snap ID
 * Format: SP-<YEAR>-<SEASON>-<HASH>
 * Example: SP-2025-B2-X9K2M
 * 
 * @param {number} sequence - Global user sequence number
 * @param {Date} [createdAt] - User creation date (default: now)
 */
export const generateSnapId = (sequence, createdAt = new Date()) => {
  const year = createdAt.getFullYear();
  const seasonCode = getSeasonCode(createdAt);
  
  // Generate unique hash based on sequence
  // Guarantees no two users have same suffix
  const hash = sqids.encode([sequence]);
  
  return `SP-${year}-${seasonCode}-${hash}`;
};

/**
 * Decode Snap ID (Optional usefulness)
 * Can extract the sequence number from the hash
 */
export const decodeSnapId = (snapId) => {
  try {
    const parts = snapId.split('-');
    if (parts.length !== 4) return null;
    
    // Suffix is the last part
    const hash = parts[3];
    const decoded = sqids.decode(hash);
    
    return decoded.length ? decoded[0] : null;
  } catch {
    return null;
  }
};
