/**
 * Time-Based Redirect Service
 * Handles timezone conversions and schedule matching for TBR feature.
 */
import { toZonedTime, format } from 'date-fns-tz';

/**
 * Check if a link is currently within its active window.
 * @param {Date|null} activeStartTime - When the link should become active (UTC)
 * @returns {boolean} True if link is active (or no start time set)
 */
export const isLinkActive = (activeStartTime) => {
    if (!activeStartTime) return true;
    return new Date() >= new Date(activeStartTime);
};

/**
 * Get the time-based redirect destination if rules match.
 * @param {Object} timeRedirects - The timeRedirects config from URL document
 * @param {Object} timeRedirects.enabled - Whether TBR is enabled
 * @param {string} timeRedirects.timezone - IANA timezone string
 * @param {Array} timeRedirects.rules - Array of schedule rules
 * @returns {string|null} Destination URL or null if no match
 */
export const getTimeBasedDestination = (timeRedirects) => {
    if (!timeRedirects?.enabled || !timeRedirects?.rules?.length) {
        return null;
    }

    const tz = timeRedirects.timezone || 'UTC';
    
    let currentTime;
    let currentDay;

    try {
        // format handles timezone conversion internally if provided in options
        currentTime = format(new Date(), 'HH:mm', { timeZone: tz });
        // Getting the day in a specific timezone is tricky without shifting
        // We can use toZonedTime for the day check, or format 'i' (ISO day) or 'e' (local day)
        // using toZonedTime is clearer for retrieving the day index
        const zonedDate = toZonedTime(new Date(), tz);
        currentDay = zonedDate.getDay(); 
    } catch {
        console.warn(`[TBR] Invalid timezone "${tz}", falling back to UTC`);
        const utcDate = toZonedTime(new Date(), 'UTC');
        currentTime = format(utcDate, 'HH:mm');
        currentDay = utcDate.getDay();
    }

    // Sort rules by priority (higher = first) for predictable matching
    const sortedRules = [...timeRedirects.rules].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const rule of sortedRules) {
        // Skip if days don't match
        if (rule.days && rule.days.length > 0 && !rule.days.includes(currentDay)) {
            continue;
        }

        // Skip invalid rules
        if (!rule.startTime || !rule.endTime || !rule.destination) {
            continue;
        }

        // Handle midnight crossing (e.g., 23:00 to 02:00)
        const isMidnightCross = rule.startTime > rule.endTime;
        const inWindow = isMidnightCross
            ? (currentTime >= rule.startTime || currentTime <= rule.endTime)
            : (currentTime >= rule.startTime && currentTime <= rule.endTime);

        if (inWindow) {
            return rule.destination;
        }
    }

    return null; // No match, use originalUrl
};
