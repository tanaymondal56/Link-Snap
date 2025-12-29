# Lemon Squeezy Subscription Integration Plan

## Executive Summary

This document outlines the implementation plan for integrating Lemon Squeezy as the subscription/payment provider for Link-Snap. It covers the complete subscription lifecycle, features behind paywall, technical implementation, edge cases, and a template for adding future premium features.

---

## Subscription Tiers & Pricing Strategy

Based on competitor analysis (Bitly, Rebrandly) and 2025 SaaS best practices, we will use a **hybrid tiered model** combining feature gating with usage limits.

| Tier | Monthly | Yearly | Target Price Point | Target User |
|------|---------|--------|--------------------|-------------|
| **Free** | $0 | $0 | Free forever | Casual users, trial |
| **Pro** | $9 | $79 | Save ~27% | Solo creators, consultants |
| **Business** | - | - | **Coming Soon** | Small agencies, growing teams |

### Best Practices Applied
- **Competitive Free Tier**: 25 links/mo (beats Bitly's 5/mo and Rebrandly's 10/mo) to drive acquisition.
- **Psychological Pricing**: $9 entry point lowers friction compared to $15+ competitors.
- **Annual Discount**: ~2 months free incentivizes cash flow and reduces churn.
- **Usage Limits**: Clicks/month caps added to prevent infrastructure abuse (crucial for "unlimited" link tiers).

### Trial Strategy
- **7-day free trial** of Pro tier for new users
- **Reverse Trial Logic**: Users getting a taste of Pro features converts better.
- No credit card required to start trial (reduces friction).
- Auto-downgrade to Free after trial ends.

---

## Features & Usage Limits

| Feature | Free | Pro | Business | Status |
|---------|------|-----|----------|--------|
| **Links/month** | 25 | 500 | 10,000* | ⏳ Logic needed |
| **Tracked Clicks/month** | 1,000 | 50,000 | 250,000 | ⏳ New Metric |
| **Custom aliases** | ❌ | ✅ | ✅ | ✅ Gate it |
| **Link expiration** | ❌ | ✅ | ✅ | ✅ Gate it |
| **Password protection** | ❌ | ✅ | ✅ | ✅ Gate it |
| **Custom datetime** | ❌ | ✅ | ✅ | ✅ Gate it |
| **Analytics retention** | 30 days | 1 year | Unlimited | ⏳ Adjusted |
| **Custom QR themes** | ❌ | ✅ | ✅ | 📋 Planned |
| **Bulk link creation** | ❌ | 50/batch | 500/batch | 📋 Planned |
| **API access** | ❌ | ✅ | ✅ | 📋 Planned |
| **Bio page** | ❌ | 1 | 5 | 📋 Planned |
| **A/B testing** | ❌ | ❌ | ✅ | 📋 Planned |
| **Device redirects** | ❌ | ❌ | ✅ | 📋 Planned |
| **Geo analytics** | Basic | Advanced | Advanced | 📋 Planned |
| **UTM builder** | ❌ | ✅ | ✅ | 📋 Planned |
| **Team members** | ❌ | ❌ | 5 | 📋 Planned |
| **Custom domains** | ❌ | 1 | 5 | 📋 Planned |

*\*Business tier link limit is a soft cap to prevent abuse.*

---

## Technical Implementation

### Environment Variables
```env
LEMONSQUEEZY_API_KEY=your_api_key
LEMONSQUEEZY_STORE_ID=your_store_id
LEMONSQUEEZY_WEBHOOK_SECRET=your_secret
LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID=123456
LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID=123457
LEMONSQUEEZY_BUSINESS_MONTHLY_VARIANT_ID=123458
LEMONSQUEEZY_BUSINESS_YEARLY_VARIANT_ID=123459

# Grace period settings
SUBSCRIPTION_GRACE_PERIOD_DAYS=7
```

### Tier Configuration
```javascript
// server/services/subscriptionService.js
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
               'utm_builder', 'bio_page', 'advanced_analytics']
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
               'team', 'webhooks', 'custom_domains', 'advanced_analytics']
  }
};

// Feature check with grace period support
export const hasFeature = (user, feature) => {
  const sub = user.subscription;
  const tier = sub?.tier || 'free';
  
  // Check if in grace period (past_due but within grace days)
  if (sub?.status === 'past_due') {
    const graceDays = parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS) || 7;
    const daysSinceDue = (Date.now() - new Date(sub.currentPeriodEnd)) / (1000 * 60 * 60 * 24);
    if (daysSinceDue > graceDays) {
      return TIERS.free.features.includes(feature);
    }
  }
  
  // Cancelled but still in billing period
  if (sub?.status === 'cancelled' && sub?.currentPeriodEnd > new Date()) {
    return TIERS[tier].features.includes(feature);
  }
  
  // Active or on_trial
  if (['active', 'on_trial'].includes(sub?.status)) {
    return TIERS[tier].features.includes(feature);
  }
  
  return TIERS.free.features.includes(feature);
};

// Get effective tier considering status
export const getEffectiveTier = (user) => {
  const sub = user.subscription;
  if (!sub || !['active', 'on_trial'].includes(sub.status)) {
    if (sub?.status === 'past_due') {
      const graceDays = parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS) || 7;
      const daysSinceDue = (Date.now() - new Date(sub.currentPeriodEnd)) / (1000 * 60 * 60 * 24);
      if (daysSinceDue <= graceDays) return sub.tier;
    }
    if (sub?.status === 'cancelled' && sub?.currentPeriodEnd > new Date()) {
      return sub.tier;
    }
    return 'free';
  }
  return sub.tier;
};
```

### User Schema Updates
```javascript
// server/models/User.js - Add:
subscription: {
  customerId: { type: String, index: true },
  subscriptionId: { type: String, index: true },
  variantId: String,
  tier: { 
    type: String, 
    enum: ['free', 'pro', 'business'], 
    default: 'free' 
  },
  billingCycle: { type: String, enum: ['monthly', 'yearly', null] },
  status: { 
    type: String, 
    enum: ['active', 'on_trial', 'past_due', 'paused', 'cancelled', 'expired', 'unpaid'],
    default: 'active' 
  },
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  trialEndsAt: Date,           // Track trial end date
  cancelledAt: Date,           // When user cancelled
  customerPortalUrl: String,
  updatePaymentUrl: String,
},
linkUsage: {
  count: { type: Number, default: 0 },
  resetAt: { type: Date, default: Date.now }
},
// New: Track monthly click usage
clickUsage: {
  count: { type: Number, default: 0 },
  resetAt: { type: Date, default: Date.now }
},
  hasUsedTrial: { type: Boolean, default: false }
}
```

### Identity System Integration

The subscription system leverages the Dual-Identity Architecture to separate technical reliability from social prestige.

#### 1. Snap ID (`snapId`) - The Immutable Core 🔒
- **Read-Only & Permanent**: This ID is the system's absolute source of truth. It is generated once upon creation and **can never be changed**, ensuring a broken-proof audit trail for billing and support.
- **Reliability**: Use this for all backend webhooks, support ticket lookups, and deep linking. It is the "Social Security Number" of the account.

#### 2. Elite ID (`eliteId`) - The Flex Tool 🎖️
- **Not just an ID, but a Story**: This is not a technical identifier; it is a **Status Symbol** representing *when* and *why* the user joined (e.g., "Pioneer-VII" tells the story of early adoption).
- **Social Signal**: Display this prominently on billing dashboards and invoices to let users "flex" their status. It exists to impress others and validate their journey, not for database lookups.
- **Prestige Integration**: Premium tiers (Pro/Business) should highlight this badge to reinforce the feeling of exclusivity.

#### 3. Custom Data in Checkout
Pass identity fields to Lemon Squeezy checkout sessions:
```javascript
checkout_data: {
  custom: {
    user_id: user._id,
    snap_id: user.snapId,  // Crucial for cross-referencing
    elite_id: user.eliteId // For personalized emails
  }
}
```

### Usage Limit Checkers
```javascript
// server/middleware/subscriptionMiddleware.js

// Check Link Creation Limit
export const checkLinkLimit = async (req, res, next) => {
  const user = req.user;
  if (!user) return next();
  
  const tier = getEffectiveTier(user);
  const limit = TIERS[tier].linksPerMonth;
  
  // Reset usage if new period
  const resetAt = user.linkUsage?.resetAt;
  const periodStart = user.subscription?.currentPeriodStart;
  if (resetAt && periodStart && resetAt < periodStart) {
    await User.findByIdAndUpdate(user._id, {
      'linkUsage.count': 0,
      'linkUsage.resetAt': new Date()
    });
    user.linkUsage.count = 0;
  }
  
  if (user.linkUsage.count >= limit) {
     // Soft Cap for Business: Log overage but allow (up to 120%)
     if (tier === 'business' && user.linkUsage.count < limit * 1.2) {
       console.warn(`[Soft Cap] Business User ${user.snapId} over limit: ${user.linkUsage.count}`);
     } else {
       return res.status(403).json({ error: 'Monthly link limit reached', limit });
     }
  }
  next();
};

// Check Click Limit (Run this on redirect, but loosely)
// Implementation: In redirectController, check limit but maybe soft-fail or show "Limit Reached" page
export const checkClickLimit = async (linkOwner) => {
  const tier = getEffectiveTier(linkOwner);
  const limit = TIERS[tier].clicksPerMonth;
  
  // Reset click usage logic similar to linkUsage...
  
  if (linkOwner.clickUsage.count >= limit) {
    // Decision: Do we block redirects? 
    // Best practice: Don't block immediately, send email warning first. 
    // Hard block only at 120% or on Free tier.
    return false; // Indicating limit reached
  }
  return true; 
};
```

---

## Client-Side Integration

### Auth Context Updates
```javascript
// client/src/context/AuthContext.jsx - Add to user state
const [subscription, setSubscription] = useState(null);

// Include subscription in user fetch
const fetchUser = async () => {
  const { data } = await api.get('/auth/me');
  setUser(data.user);
  setSubscription(data.user.subscription);
};

// Helper for components
const hasPremium = subscription?.tier !== 'free' && 
  ['active', 'on_trial'].includes(subscription?.status);
```

### Upgrade Prompt Component
```jsx
// client/src/components/UpgradePrompt.jsx
const UpgradePrompt = ({ feature, inline = false }) => {
  const featureNames = {
    custom_alias: 'Custom Aliases',
    link_expiration: 'Link Expiration',
    password_protection: 'Password Protection',
    // ... map features to display names
  };
  
  // Return UI component...
};
```

---

## Edge Cases & Error Handling

| Edge Case | Solution | Implementation |
|-----------|----------|----------------|
| Webhook delivery failure | Lemon Squeezy retries for 3 days | Return 200 even on processing errors |
| Duplicate webhooks | Store event IDs in DB | Check before processing, skip duplicates |
| Downgrade with over-limit links | Allow existing, block new | Check limit only on creation |
| Payment failed | 7-day grace period | Check `past_due` status + days elapsed |
| Trial abuse (re-use email) | Track `hasUsedTrial` flag | Check before granting trial |
| Cancelled mid-period | Keep access until period end | Check `cancelled` + `currentPeriodEnd` |
| **Click Limit Reached** | **Soft block** | **Email warning at 80%, hard block at 110%** |
| Webhook before checkout redirect | Show loading state | Poll subscription status after checkout |
| Timezone issues | Use UTC everywhere | Store/compare all dates as UTC |
| Subscription paused | Treat as free tier | Check `status !== 'paused'` |
| User deletes account | Cancel subscription first | Call Lemon Squeezy API before delete |
| Upgrade/downgrade mid-cycle | Lemon Squeezy prorates | Just update tier on webhook |
| Portal URL expired | Fetch fresh URL from API | Regenerate if > 23h old |
| **Race Conditions** | **Atomic Updates** | **Use `$inc` for usage counters vs read-modify-write** |
| Payment Failed (Dunning) | Listen to `subscription_payment_failed` | Email user + Grace Period (don't cancel immediately) |
| Webhook Concurrency | Locking / Idempotency | Store `webhook_id` in Redis/DB to process once |
| Sync/Restore Purchase | **New Button** | User settings: "Sync Subscription" (fetches from LS) |

### Final Pre-Flight Checklist 🛫
- [ ] **Env Vars**: Are `LEMONSQUEEZY_WEBHOOK_SECRET` and `API_KEY` set in Production?
- [ ] **Webhooks**: Is the URL reachable? (test with `ngrok` first).
- [ ] **Atomic Usage**: Ensure `findOneAndUpdate` with `$inc` is used for clicks/links.
- [ ] **Snap ID Logging**: Verify logs contain `snapId`.
- [ ] **Database Indexes**: Index `subscription.customerId` and `subscription.subscriptionId`.
- [ ] **Grace Period**: Test `past_due` logic with a mock date.
- [ ] **Business Hidden**: Verify Business tier is hidden in UI.

---

## Security Checklist

- ✅ Verify webhook HMAC signature
- ✅ Store API keys in env only
- ✅ Never trust client tier claims - always check DB
- ✅ Rate limit checkout creation (5/min per user)
- ✅ Portal URLs expire in 24h
- ✅ Log all subscription changes for audit
- ✅ Validate variantId belongs to your store
- ✅ Sanitize custom_data from webhooks

---

## Future Feature Paywall Template

### Step 1: Add to TIERS config
```javascript
// server/services/subscriptionService.js
TIERS.pro.features.push('new_feature_key');
```

### Step 2: Add middleware to route
```javascript
// server/routes/featureRoutes.js
router.post('/new-feature', 
  protect, 
  requireFeature('new_feature_key'),
  newFeatureController
);
```

### Step 3: Add client-side check
```jsx
// In component
const { subscription } = useAuth();
const canUse = hasFeature(subscription, 'new_feature_key');

{!canUse && <UpgradePrompt feature="new_feature_key" />}
{canUse && <ActualFeatureUI />}
```

### Coming Soon - UI Template 🚧
For features that are planned for a tier but not yet built (like those in the **Business** tier), use this pattern to build anticipation without over-promising.

```jsx
// client/src/components/ComingSoonFeature.jsx
import { Hammer } from 'lucide-react';

const ComingSoonFeature = ({ title, description }) => (
  <div className="border border-white/10 rounded-xl p-6 bg-white/5 relative overflow-hidden group">
    {/* "Coming Soon" Badge */}
    <div className="absolute top-3 right-3 px-2 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold uppercase rounded border border-blue-500/30">
      Coming Soon
    </div>
    
    <div className="opacity-50 blur-[1px] group-hover:blur-0 transition-all duration-500">
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 text-sm mb-4">{description}</p>
        <div className="h-32 bg-gray-800/50 rounded-lg border border-white/5 flex items-center justify-center">
           <Hammer className="text-gray-600 mb-2" size={32} />
        </div>
    </div>
    
    {/* Interest Capture (Optional) */}
    <div className="absolute inset-0 flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm">
       <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
         Notify Me
       </button>
    </div>
  </div>
);
```

### Checklist for Adding Premium Features
- [ ] Add feature key to `TIERS.features` array
- [ ] Add `requireFeature('key')` middleware to API route(s)
- [ ] Add client-side feature check in component
- [ ] Add upgrade prompt UI for locked state
- [ ] Update pricing page feature comparison table
- [ ] Update marketing/landing page
- [ ] Add to onboarding/trial prompts
- [ ] Add analytics tracking for upgrade prompt views


---

## Redeem Codes & Lifetime Deals

### Strategy
- **Marketing & Support**: Generate one-time use codes for giveaways, support appeasement, or lifetime deals (LTDs).
- **Format**: `TIER-DURATION-RANDOM` (e.g., `PRO-1M-A1B2C3`, `BIZ-LIFETIME-X9Y8Z7`)
- **Validation**: Check usage status, expiration date, and tier validity.

### Implementation

#### Schema Update (RedeemCode Model)
```javascript
// server/models/RedeemCode.js
{
  code: { type: String, unique: true, index: true },
  tier: { type: String, enum: ['pro', 'business'] },
  duration: { type: String, enum: ['1_month', '1_year', 'lifetime'] },
  maxUses: { type: Number, default: 1 },
  usedCount: { type: Number, default: 0 },
  expiresAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, // Admin
  createdAt: { type: Date, default: Date.now }
}
```

#### API Endpoints
- `POST /api/admin/redeem-codes/generate` (Admin only)
- `POST /api/subscription/redeem` (User: Apply code)

#### Redemption Logic
1. User enters code in Billing Dashboard.
2. System validates code (exists, not expired, usage < maxUses).
3. If valid:
   - Update User's `subscription.tier` and `subscription.status` = 'active'.
   - If duration is finite, set `subscription.currentPeriodEnd`.
   - If lifetime, set `currentPeriodEnd` to far future (e.g., year 2099) and `billingCycle` to 'lifetime'.
   - Increment `code.usedCount`.

---

## 🔒 Feature Locking Architecture

To drive upgrades, we need a standard way to show "Locked" features that are visible but inaccessible.

### The "Lock" Component
The UI should show these features but dimmed with a padlock icon.

```jsx
// client/src/components/LockedFeature.jsx
import { Lock } from 'lucide-react';

const LockedFeature = ({ children, tierRequired = 'pro' }) => {
  const { hasFeature } = useAuth();
  
  if (hasFeature(children.props.featureKey)) {
    return children;
  }

  return (
    <div className="relative group overflow-hidden rounded-xl border border-white/5 bg-gray-900/50">
      {/* Blurred Content */}
      <div className="blur-sm opacity-50 pointer-events-none select-none grayscale p-4">
        {children}
      </div>

      {/* The Lock Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] z-10 transition-opacity">
        <div className="p-3 bg-gray-800 rounded-full border border-white/10 shadow-xl mb-2 group-hover:scale-110 transition-transform">
          <Lock size={20} className="text-amber-400" />
        </div>
        <p className="text-amber-400 font-bold text-sm uppercase tracking-wider mb-2">
          {tierRequired} Feature
        </p>
        <button className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg hover:shadow-amber-500/20 transition-all">
          Unlock Access
        </button>
      </div>
    </div>
  );
};
```

**Usage**:
```jsx
<LockedFeature tierRequired="pro">
  <AdvancedAnalyticsChart featureKey="advanced_analytics" />
</LockedFeature>
```

---

## 🌍 Regional Pricing & Localization

Lemon Squeezy handles tax and currency conversion automatically, but we must display the correct price in our UI *before* checkout to avoid "sticker shock".

### Strategy
1.  **Do NOT Hardcode Prices**: Removing strings like "$9/mo" from the frontend code.
2.  **Fetch Localized Price**: Use Lemon Squeezy's `GET /v1/prices` or a lightweight proxy endpoint to get the visitor's detected currency.

### Implementation
```javascript
// server/controllers/subscriptionController.js
export const getPricing = async (req, res) => {
  // Pass client IP to Lemon Squeezy for accurate geo-detection
  // Or rely on Lemon Squeezy's default behavior
  // This endpoint should cache results heavily (e.g. 1 hour)
  
  const prices = {
    pro_monthly: { amount: 900, currency: 'USD', display: '$9.00' }, 
    // ... default fallback
  };
  
  // Optional: Real-time fetch from LS API if needed for strict accuracy
  // but usually generic USD display with "Local pricing at checkout" text is safer for performance.
  
  res.json(prices);
};
```

**Frontend Display**:
- Show `approx. $9/mo` (generic) OR
- Show `₹850/mo` (if detected India).
- **Golden Rule**: Always add small text: *"Final price calculated at checkout based on your region."*

---

## Admin Panel Integration

### Features to Add
1. **Subscription Overview Dashboard**:
   - Total MRR/ARR (fetch from Lemon Squeezy API)
   - Active Subscribers count (Free vs Pro vs Business)
   - Churn rate visualization

2. **User Management**:
   - View user's current tier and status
   - **Manual Override**: Ability to manually set a user's plan (for support).
   - **Sync Button**: "Force Sync" with Lemon Squeezy to fix any data mismatches.

3. **Redeem Code Manager**:
   - Generate single or bulk codes.
   - List active codes and their usage stats.
   - Revoke/Delete codes.

### UI Changes (Admin Panel)
- **New Tab**: "Subscriptions" or "Monetization"
- **Sub-tabs**:
  - *Overview*: KPIs and Charts
  - *Plans*: Quick view of active tiers (read-only config)
  - *Redeem Codes*: Generator and list view
  - *Customers*: List of paid users with "Manage" actions

---

## Implementation Phases (Updated)

| Week | Tasks |
|------|-------|
| 1 | Lemon Squeezy setup, env vars, User schema, WebhookEvent model |
| 2 | Subscription service, webhook handlers, idempotency, checkout flow |
| 3 | Feature gating middleware, pricing page, upgrade prompts |
| 4 | Gate existing features, usage limits, **Redeem Code System** |
| 5 | **Admin Panel Integration**, E2E testing, edge cases |
| 6 | Billing page, customer portal, polish, deployment |

---

## Files to Create/Modify (Updated)

| File | Action | Purpose |
|------|--------|---------|
| `server/services/subscriptionService.js` | CREATE | Tier config, feature checks |
| `server/controllers/subscriptionController.js` | CREATE | Checkout, portal, **redemption** |
| `server/controllers/adminSubscriptionController.js` | CREATE | **Admin management** |
| `server/models/RedeemCode.js` | CREATE | **Code schema** |
| `client/src/pages/admin/AdminSubscription.jsx` | CREATE | **Admin UI** |
| ... | ... | (Rest of previous files) |

