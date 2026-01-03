// eslint-disable-next-line no-unused-vars -- User imported for JSDoc type hints
import User from '../models/User.js';

export const TIERS = {
  free: {
    name: 'Free',
    linksPerMonth: 25,
    clicksPerMonth: 1000,
    analyticsRetention: 30, // days
    features: ['basic_links', 'basic_analytics']
  },
  pro: {
    name: 'Pro',
    linksPerMonth: 500,
    clicksPerMonth: 50000,
    analyticsRetention: 365,
    features: ['custom_alias', 'link_expiration', 'password_protection', 
               'custom_datetime', 'custom_qr', 'api_access', 'geo_analytics', 
               'utm_builder', 'bio_page', 'device_targeting', 'advanced_analytics']
  },
  business: {
    name: 'Business',
    ui: { hidden: true, badge: 'Coming Soon' }, // Not ready for public yet
    linksPerMonth: 10000, // Soft cap
    clicksPerMonth: 250000,
    analyticsRetention: Infinity,
    features: ['custom_alias', 'link_expiration', 'password_protection',
               'custom_datetime', 'custom_qr', 'api_access', 'geo_analytics',
               'utm_builder', 'bio_page', 'ab_testing', 'device_redirects',
               'device_targeting', 'team', 'webhooks', 'custom_domains', 'advanced_analytics']
  }
};

/**
 * Check if a user has access to a specific feature
 * Handles grace periods, trial logic, and cancelled states
 */
export const hasFeature = (user, feature) => {
  const sub = user.subscription;
  const tier = sub?.tier || 'free';
  
  // Check if in grace period (past_due but within grace days)
  if (sub?.status === 'past_due') {
    const graceDays = parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS) || 7;
    const daysSinceDue = sub.currentPeriodEnd 
      ? (Date.now() - new Date(sub.currentPeriodEnd)) / (1000 * 60 * 60 * 24)
      : 0;
      
    if (daysSinceDue > graceDays) {
      // Grace period expired - downgrade to free features
      return TIERS.free.features.includes(feature);
    }
    // Within grace period - allow current tier features
    return TIERS[tier]?.features.includes(feature);
  }
  
  // Cancelled but still in billing period
  if (sub?.status === 'cancelled') {
    if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) > new Date()) {
      return TIERS[tier]?.features.includes(feature);
    } else {
      // Period ended
      return TIERS.free.features.includes(feature);
    }
  }
  
  // Active or on_trial
  if (['active', 'on_trial'].includes(sub?.status)) {
    return TIERS[tier]?.features.includes(feature);
  }
  
  // Default to Free tier
  return TIERS.free.features.includes(feature);
};

/**
 * Get effective tier considering status and grace period
 */
export const getEffectiveTier = (user) => {
  const sub = user.subscription;
  if (!sub || !['active', 'on_trial', 'past_due', 'cancelled'].includes(sub.status)) {
    return 'free';
  }
  
  const tier = sub.tier;
  
  if (sub.status === 'past_due') {
    const graceDays = parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS) || 7;
    const daysSinceDue = sub.currentPeriodEnd 
      ? (Date.now() - new Date(sub.currentPeriodEnd)) / (1000 * 60 * 60 * 24)
      : 0;
      
    if (daysSinceDue > graceDays) return 'free';
  }
  
  if (sub.status === 'cancelled') {
     if (!sub.currentPeriodEnd || new Date(sub.currentPeriodEnd) <= new Date()) {
       return 'free';
     }
  }

  // Paused status - treat similar to cancelled (access until period end)
  if (sub.status === 'paused') {
     if (!sub.currentPeriodEnd || new Date(sub.currentPeriodEnd) <= new Date()) {
       return 'free';
     }
  }

  // Handle expired/unpaid explicitly if needed, but default fallback handles it
  if (['expired', 'unpaid'].includes(sub.status)) return 'free';
  
  return tier;
};
