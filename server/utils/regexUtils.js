/**
 * Escape special characters in a string for use in a regular expression.
 * Prevents ReDoS attacks when creating RegExp from user input.
 * @param {string} str - The string to escape
 * @returns {string} - Escaped string safe for RegExp constructor
 */
export const escapeRegex = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
