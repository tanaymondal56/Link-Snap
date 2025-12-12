/**
 * Shared utility functions for the admin panel
 */

/**
 * Format uptime in seconds to a human-readable string
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime string (e.g., "2d 5h 30m")
 */
export const formatUptime = (seconds) => {
  if (!seconds) return 'N/A';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

/**
 * Check if a user is banned (handles both field types for backward compatibility)
 * @param {Object} user - User object
 * @returns {boolean} Whether the user is banned
 */
export const isUserBanned = (user) => user.banned || user.isActive === false;
