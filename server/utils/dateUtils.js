export const calculateSubscriptionEndDate = (startDate, durationStr) => {
  const date = startDate ? new Date(startDate) : new Date();
  if (Number.isNaN(date.getTime())) {
    date.setTime(Date.now());
  }
  
  const dStr = String(durationStr || '').trim().toLowerCase();

  // Handle lifetime immediately
  if (dStr === 'lifetime') {
    date.setFullYear(date.getFullYear() + 100);
    return date;
  }

  const copy = new Date(date);
  let monthsToAdd = 0;
  let yearsToAdd = 0;

  // Handle minute durations (e.g. '1_min', '5_mins', '1_minute', '5_minutes', '1m', '5m')
  const minsMatch = dStr.match(/^(\d+)(?:_(?:min|minute)s?|m)$/);
  if (minsMatch) {
    const mins = parseInt(minsMatch[1], 10);
    copy.setMinutes(copy.getMinutes() + mins);
    return copy;
  }

  // Handle custom days (e.g. '1_day', '7_days', '14_days', '29_days', '1d', '30d')
  const daysMatch = dStr.match(/^(\d+)(?:_days?|d)$/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  switch (dStr) {
    case '1_month': monthsToAdd = 1; break;
    case '3_months': monthsToAdd = 3; break;
    case '6_months': monthsToAdd = 6; break;
    case '1_year': yearsToAdd = 1; break;
    default:
        // Default fallback or error? Assuming 0 change if unknown
        break;
  }

  if (yearsToAdd > 0) {
    const currentMonth = copy.getMonth();
    copy.setFullYear(copy.getFullYear() + yearsToAdd);
    // Handle leap year (Feb 29 + 1 year -> Feb 28, not Mar 1)
    if (copy.getMonth() !== currentMonth) {
      copy.setDate(0);
    }
  }
  
  if (monthsToAdd > 0) {
    const currentDay = copy.getDate();
    copy.setMonth(copy.getMonth() + monthsToAdd);
    
    // Handle overflow (e.g., Jan 31 + 1 month -> Feb 28/29, not Mar 3)
    if (copy.getDate() !== currentDay) {
      copy.setDate(0);
    }
  }
  
  return copy;
};
