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
    copy.setFullYear(copy.getFullYear() + yearsToAdd);
  }
  
  if (monthsToAdd > 0) {
    const currentDay = copy.getDate();
    copy.setMonth(copy.getMonth() + monthsToAdd);
    
    // Handle overflow (e.g., Jan 31 + 1 month -> Mar 3)
    // If the day changed, it means the target month didn't have enough days
    if (copy.getDate() !== currentDay) {
      copy.setDate(0); // Go back to last day of previous month (the target month)
    }
  }
  
  return copy;
};
