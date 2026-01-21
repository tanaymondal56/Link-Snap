export const TIERS = {
  free: { features: ['basic_links', 'basic_analytics'] },
  pro: { features: ['custom_alias', 'link_expiration', 'password_protection', 'custom_datetime', 'custom_qr', 'api_access', 'geo_analytics', 'utm_builder', 'bio_page', 'device_targeting', 'time_redirects', 'advanced_analytics'] },
  business: { features: ['custom_alias', 'link_expiration', 'password_protection', 'custom_datetime', 'custom_qr', 'api_access', 'geo_analytics', 'utm_builder', 'bio_page', 'ab_testing', 'device_redirects', 'device_targeting', 'time_redirects', 'team', 'webhooks', 'custom_domains', 'advanced_analytics'] }
};

export const GRACE_PERIOD_DAYS = 7; // Sync with backend SUBSCRIPTION_GRACE_PERIOD_DAYS

export const isWithinGracePeriod = (sub) => {
    if (!sub?.currentPeriodEnd) return false;
    const daysSinceDue = (Date.now() - new Date(sub.currentPeriodEnd)) / (1000 * 60 * 60 * 24);
    return daysSinceDue < GRACE_PERIOD_DAYS;
};

export const hasFeature = (user, feature) => {
    const sub = user?.subscription;
    const tier = sub?.tier || 'free';
    const status = sub?.status;
    

    // Simple check for valid subscription status
    // Active, On Trial, Unpaid/PastDue (within grace), Cancelled/Paused (within period)
    if (['active', 'on_trial'].includes(status) || 
        (status === 'past_due' && isWithinGracePeriod(sub)) ||
        (['cancelled', 'paused'].includes(status) && sub?.currentPeriodEnd && new Date(sub.currentPeriodEnd) > new Date())) {
         return TIERS[tier]?.features.includes(feature) || TIERS.free.features.includes(feature);
    }
    return TIERS.free.features.includes(feature);
};

// Get effective tier - considers subscription status
// Note: Does NOT give admins automatic tier upgrade - they keep their actual subscription tier
export const getEffectiveTier = (user) => {
    if (!user) return 'free';
    
    const sub = user.subscription;
    if (!sub) return 'free';
    
    const status = sub.status;
    const tier = sub.tier || 'free';
    
    // Active / Trial
    if (['active', 'on_trial'].includes(status)) return tier;

    // Past Due (Grace Period)
    if (status === 'past_due' && isWithinGracePeriod(sub)) return tier;

    // Cancelled / Paused (Remaining Period)
    if (['cancelled', 'paused'].includes(status) && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) > new Date()) {
        return tier;
    }

    return 'free';
};

// Check if user is on free tier (admins on free tier still count as free for UI purposes)
export const isFreeTier = (user) => {
    return getEffectiveTier(user) === 'free';
};

// Check if user is a Pro subscriber
export const isProTier = (user) => {
    return getEffectiveTier(user) === 'pro';
};

// Check if user is on a PAID tier (Pro or Business) - for hiding upgrade prompts
export const isPaidTier = (user) => {
    const tier = getEffectiveTier(user);
    return tier === 'pro' || tier === 'business';
};

// Check if pricing banner should be shown
export const shouldShowPricingBanner = (user) => {
    if (!user) return true; // Not logged in
    const tier = getEffectiveTier(user);
    return tier === 'free'; // Show only for free tier (admins on free will see it)
};
