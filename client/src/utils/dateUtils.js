/**
 * Format a date string or object into a localized string (Date only).
 * Uses the user's browser/system timezone.
 * Example: "Oct 24, 2025" or "10/24/2025" depending on locale.
 */
export const formatDate = (dateValue) => {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  
  // Check if date is valid
  if (isNaN(date.getTime())) return dateValue;

  return new Intl.DateTimeFormat('default', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

/**
 * Format a date string or object into a localized string with Time.
 * Uses the user's browser/system timezone.
 * Example: "Oct 24, 2025, 10:30 PM"
 */
export const formatDateTime = (dateValue) => {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  
  if (isNaN(date.getTime())) return dateValue;

  return new Intl.DateTimeFormat('default', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true, // Use AM/PM
  }).format(date);
};

/**
 * Format a date for <input type="date"> (YYYY-MM-DD).
 * Ensures usage of LOCAL time values, not UTC shifted values.
 */
export const toInputDate = (dateValue) => {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Format a date for <input type="datetime-local"> (YYYY-MM-DDThh:mm).
 * Ensures usage of LOCAL time values.
 */
export const toInputDateTime = (dateValue) => {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};
