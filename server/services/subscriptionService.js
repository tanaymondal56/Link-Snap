// eslint-disable-next-line no-unused-vars -- User imported for JSDoc type hints
import User from '../models/User.js';

export const TIERS = {
  free: {
    name: 'Free',
    linksPerMonth: 100,        // Hard Limit (Total created per month)
    activeLimit: 25,           // Active Limit (Concurrent live links)
    clicksPerMonth: 1000,
    analyticsRetention: 30,    // days
    features: ['basic_links', 'basic_analytics']
  },
  pro: {
    name: 'Pro',
    linksPerMonth: 2000,       // Hard Limit
    activeLimit: 500,          // Active Limit
    clicksPerMonth: 50000,
    analyticsRetention: 365,   // 1 year
    features: ['custom_alias', 'link_expiration', 'password_protection',
               'custom_datetime', 'custom_qr', 'api_access', 'geo_analytics',
               'utm_builder', 'bio_page', 'device_targeting', 'advanced_analytics', 'time_redirects']
  },
  business: {
    name: 'Business',
    ui: { hidden: true, badge: 'Coming Soon' }, // Not ready for public yet — flip hidden:false on launch
    // ── Final Production Limits ──────────────────────────────────────────────
    linksPerMonth: Infinity,   // Unlimited link creation (soft-cap warnings logged internally)
    activeLimit: Infinity,     // Unlimited concurrent active links
    clicksPerMonth: 500000,    // 500K clicks/month (hard cap at 120% soft limit in subscriptionMiddleware)
    analyticsRetention: Infinity, // Permanent analytics history
    // ── Features: All Pro + Business-exclusive ───────────────────────────────
    // Business-exclusive features are marked with (* Business) in FEATURE_METADATA below.
    // They are implemented as documented stubs — wire up when the feature ships.
    features: [
      // ── Inherited from Pro ──────────────────────────────────────
      'custom_alias',          // Custom short link slugs
      'link_expiration',       // Set link expiry by date/preset
      'password_protection',   // Password-lock links
      'custom_datetime',       // Custom creation timestamps
      'custom_qr',             // Branded QR code styles
      'api_access',            // REST API access (documented stub — see FEATURE_METADATA)
      'geo_analytics',         // Country/city breakdown analytics
      'utm_builder',           // UTM parameter builder on link creation
      'bio_page',              // Link-in-Bio page builder
      'device_targeting',      // Per-device redirect rules
      'advanced_analytics',    // Full analytics suite (retention, funnel, etc.)
      'time_redirects',        // Time-based redirect scheduling
      // ── Business-Exclusive ──────────────────────────────────────
      'ab_testing',            // (* Business) A/B split testing for links — see FEATURE_METADATA
      'device_redirects',      // (* Business) Advanced device redirect rules (superset of device_targeting)
      'team',                  // (* Business) Team/workspace management — see FEATURE_METADATA
      'webhooks',              // (* Business) Outbound webhooks for link events — see FEATURE_METADATA
      'custom_domains',        // (* Business) Bring-your-own domain — see FEATURE_METADATA
    ]
  }
};

// ============================================================
//  FEATURE METADATA — Reference for all features across tiers
//  Used for: upgrade modals, error messages, future feature gates
//  status: 'live' | 'stub' | 'planned'
// ============================================================
export const FEATURE_METADATA = {
  // ── Free ──────────────────────────────────────────────────────────
  basic_links: {
    label: 'Basic Link Shortening',
    tier: 'free', status: 'live',
    description: 'Create short links with auto-generated IDs.'
  },
  basic_analytics: {
    label: 'Basic Analytics',
    tier: 'free', status: 'live',
    description: 'Total click count and last-accessed date per link.'
  },

  // ── Pro ───────────────────────────────────────────────────────────
  custom_alias: {
    label: 'Custom Aliases',
    tier: 'pro', status: 'live',
    description: 'Choose a custom slug for your short link (e.g. /my-brand).'
  },
  link_expiration: {
    label: 'Link Expiration',
    tier: 'pro', status: 'live',
    description: 'Set links to auto-expire after a preset or custom date.'
  },
  password_protection: {
    label: 'Password Protection',
    tier: 'pro', status: 'live',
    description: 'Require a password before visitors can access the link.'
  },
  custom_datetime: {
    label: 'Custom Creation Date',
    tier: 'pro', status: 'live',
    description: 'Override the link creation timestamp for scheduling display purposes.'
  },
  custom_qr: {
    label: 'Custom QR Styles',
    tier: 'pro', status: 'live',
    description: 'Branded QR codes with custom colours and logo embedding.'
  },
  api_access: {
    label: 'API Access',
    tier: 'pro', status: 'stub',
    description: 'REST API for programmatic link creation and management.',
    // TODO: Implement dedicated /api/v1 routes protected by API key (not session JWT).
    // API keys should be generated per-user and stored hashed in DB.
    // Rate limits: Pro = 1000 req/day, Business = 10000 req/day.
    // See: server/routes/ — add apiRoutes.js when ready.
  },
  geo_analytics: {
    label: 'Geo Analytics',
    tier: 'pro', status: 'live',
    description: 'Country and city breakdown of link clicks using GeoIP.'
  },
  utm_builder: {
    label: 'UTM Builder',
    tier: 'pro', status: 'live',
    description: 'Append UTM parameters to destination URLs at link creation.'
  },
  bio_page: {
    label: 'Link-in-Bio Page',
    tier: 'pro', status: 'live',
    description: 'Fully customisable bio page aggregating your links.'
  },
  device_targeting: {
    label: 'Device Targeting',
    tier: 'pro', status: 'live',
    description: 'Route clicks to different URLs based on visitor device (iOS, Android, desktop).'
  },
  advanced_analytics: {
    label: 'Advanced Analytics',
    tier: 'pro', status: 'live',
    description: 'Full analytics suite: retention charts, funnel analysis, referrer breakdown, and device stats.'
  },
  time_redirects: {
    label: 'Time-Based Redirects',
    tier: 'pro', status: 'live',
    description: 'Schedule links to redirect to different destinations based on time of day or day of week.'
  },

  // ── Business-Exclusive ────────────────────────────────────────────
  ab_testing: {
    label: 'A/B Testing',
    tier: 'business', status: 'stub',
    description: 'Split incoming clicks across multiple destination URLs with configurable traffic weights.',
    // TODO: Extend Url model with `abTest: { enabled: Boolean, variants: [{ url, weight, label }] }`.
    // In redirectController.js: when abTest.enabled, pick a variant by weighted random selection.
    // Track per-variant click counts in analytics for conversion reporting.
    // UI: Add A/B Testing tab to the link creation/edit modal (client/src/components/links/).
  },
  device_redirects: {
    label: 'Advanced Device Redirects',
    tier: 'business', status: 'live',
    description: 'Granular device-based redirect rules (superset of Pro device targeting, supports custom OS rules).',
    // NOTE: device_redirects is a superset of device_targeting (which is listed separately).
    // 'device_targeting' (Pro) = basic device rules stored in Url.deviceRedirects.
    // 'device_redirects' (Business) = same underlying field but with additional rule types (OS version, browser).
    // For now, both map to the same implementation — differentiate at the UI layer.
  },
  team: {
    label: 'Team & Workspace',
    tier: 'business', status: 'stub',
    description: 'Invite up to 5 team members to a shared workspace with role-based access.',
    // TODO: Create Workspace model: { name, ownerId, members: [{ userId, role: 'editor'|'viewer'|'admin' }] }.
    // Create WorkspaceInvite model for email invite flow.
    // Restrict link visibility to workspace members.
    // Admin panel: Show workspace breakdown in subscription stats.
    // Routes: POST /api/workspace, POST /api/workspace/invite, etc.
  },
  webhooks: {
    label: 'Webhooks',
    tier: 'business', status: 'stub',
    description: 'Receive HTTP POST callbacks to your endpoint when link events occur (click, expiry, creation).',
    // TODO: Create Webhook model: { userId, url, secret, events: ['click', 'expire', 'create'], active }.
    // In relevant controllers (redirectController, urlController), after core action:
    //   call webhookService.dispatch(userId, eventType, payload) — fire-and-forget.
    // webhookService should sign payloads with HMAC-SHA256 using the stored secret.
    // Implement retry logic: 3 retries with exponential backoff, dead-letter after failure.
    // Routes: CRUD /api/webhooks, test endpoint POST /api/webhooks/:id/test.
  },
  custom_domains: {
    label: 'Custom Domains',
    tier: 'business', status: 'stub',
    description: 'Use your own domain (e.g. go.yourbrand.com) for short links.',
    // TODO: Create CustomDomain model: { userId, domain, verified, txtRecord, verifiedAt }.
    // Verification flow: Generate unique TXT record → user adds to DNS → periodic job checks DNS.
    // In redirectController.js: resolve incoming Host header → look up CustomDomain → route to correct user.
    // Nginx config: wildcard SSL cert (Let's Encrypt DNS-01) or per-domain cert provisioning.
    // Routes: POST /api/domains, POST /api/domains/:id/verify, DELETE /api/domains/:id.
  },
};

// ============================================================
//  TIER HIERARCHY — Eliminates hardcoded tier comparisons
//  Usage: isTierAtLeast(userTier, requiredTier) → boolean
// ============================================================
export const TIER_RANK = { free: 0, pro: 1, business: 2 };

/** Check if a user's tier meets or exceeds the required tier. */
export const isTierAtLeast = (userTier, requiredTier) =>
  (TIER_RANK[userTier] ?? 0) >= (TIER_RANK[requiredTier] ?? 0);

/**
 * Get the minimum tier required for a feature string.
 * Falls back to 'pro' if the feature isn't in FEATURE_METADATA.
 */
export const getRequiredTierForFeature = (featureKey) =>
  FEATURE_METADATA[featureKey]?.tier || 'pro';

/**
 * Build a user-facing upgrade error message for a denied feature.
 * Example: 'Custom aliases require the Pro plan.'
 */
export const getUpgradeMessage = (featureKey) => {
  const meta = FEATURE_METADATA[featureKey];
  if (!meta) return 'This feature requires a higher plan.';
  const tierName = TIERS[meta.tier]?.name || meta.tier;
  return `${meta.label} requires the ${tierName} plan.`;
};

// ============================================================
//  RUNTIME VALIDATION — Ensures Business ⊇ Pro at startup
// ============================================================
(() => {
  const proFeatures = new Set(TIERS.pro.features);
  const businessFeatures = new Set(TIERS.business.features);
  const missingInBusiness = [...proFeatures].filter(f => !businessFeatures.has(f));
  if (missingInBusiness.length > 0) {
    // Will print during server startup, making misconfiguration immediately visible
    console.error(
      `⚠️  [TIER CONFIG ERROR] Business tier is MISSING Pro features: ${missingInBusiness.join(', ')}. ` +
      `Business MUST be a superset of Pro. Fix TIERS in subscriptionService.js.`
    );
  }
})();

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
