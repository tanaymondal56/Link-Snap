// Subscription Tier Configuration
// NOTE: These must be kept in sync with server/services/subscriptionService.js

export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    activeLimit: 25,
    monthlyLimit: 100,
    clicksLimit: 1000,
    price: 0,
    label: 'Free Tier'
  },
  pro: {
    name: 'Pro',
    activeLimit: 500,
    monthlyLimit: 2000,
    clicksLimit: 50000,
    price: 9,
    label: 'Pro'
  },
  business: {
    name: 'Business',
    activeLimit: Infinity, // effectively infinite for UI
    monthlyLimit: 10000,
    clicksLimit: 250000,
    price: 49,
    label: 'Business'
  }
};

export const getTierConfig = (tierName) => {
  const key = tierName?.toLowerCase() || 'free';
  return SUBSCRIPTION_TIERS[key] || SUBSCRIPTION_TIERS.free;
};
