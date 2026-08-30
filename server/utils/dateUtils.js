export const calculateSubscriptionEndDate = (startDate, durationStr) => {
  const date = new Date(startDate);
  
  // Handle lifetime immediately
  if (durationStr === 'lifetime') {
    date.setFullYear(date.getFullYear() + 100);
    return date;
  }

  const copy = new Date(date);
  let monthsToAdd = 0;
  let yearsToAdd = 0;

  // Handle custom days (e.g. '1_day', '7_days', '14_days', '29_days')
  const daysMatch = String(durationStr).match(/^(\d+)_days?$/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  switch (durationStr) {
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
