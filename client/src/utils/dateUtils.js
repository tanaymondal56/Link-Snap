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

/**
 * Format a duration key (e.g. '1_day', '7_days', '1_month', 'lifetime')
 * into a human-readable string (e.g. '1 Day', '7 Days', '1 Month', 'Lifetime').
 */
export const formatDuration = (key) => {
  if (!key) return '';
  const map = {
    '1_day': '1 Day',
    '3_days': '3 Days',
    '7_days': '7 Days',
    '14_days': '14 Days',
    '1_month': '1 Month',
    '3_months': '3 Months',
    '6_months': '6 Months',
    '1_year': '1 Year',
    lifetime: 'Lifetime',
  };
  if (map[key]) return map[key];
  const match = String(key).match(/^(\d+)_days?$/);
  if (match) {
    const n = parseInt(match[1], 10);
    return `${n} ${n === 1 ? 'Day' : 'Days'}`;
  }
  return key.replace(/_/g, ' ');
};

export const getDurationLabel = formatDuration;
