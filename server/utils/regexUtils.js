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

/**
 * Validates a URL using the URL constructor rather than a Regex to prevent ReDoS attacks.
 * Also enforces http/https protocols.
 * @param {string} str - The URL to validate
 * @returns {boolean}
 */
export const isValidUrl = (str) => {
  try {
    const parsed = new URL(str);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};
