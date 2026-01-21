// eslint-disable-next-line no-unused-vars -- Keeping TIERS import for reference documentation
import { TIERS } from '../services/subscriptionService.js';
import User from '../models/User.js';
import axios from 'axios';
import logger from '../utils/logger.js';

/**
 * Get localized pricing for the pricing page.
 * Ideally, we should use Lemon Squeezy's API to get the visitor's currency.
 * BUT, Lemon Squeezy's API usually requires a checkout session to detect location accurately,
 * or we can use the `GET /v1/prices` if available (feature might be limited).
 * 
 * Strategy:
 * 1. Return generic USD prices processed server-side.
 * 2. If client sends country code (optional), we might adjust.
 * 3. Best approach (Simpler): Just return standard USD prices. 
 *    Lemon Squeezy handles localization at checkout.
 *    We will return a display string "approx." if needed in future.
 */
export const getPricing = async (req, res) => {
  try {
     // For now, return the static configuration enriched with Variant IDs
     const pricing = {
       currency: 'USD',
       tiers: {
         pro: {
           monthly: {
             amount: 900, // $9.00
             display: '$9.00',
             variantId: parseInt(process.env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID),
             interval: 'month'
           },
           yearly: {
             amount: 9000, // $90.00
             display: '$90.00',
             variantId: parseInt(process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID),
             interval: 'year',
             saving: '17%' // (108 - 90) / 108
           }
         },
         business: {
            // Placeholder for future
            display: 'Coming Soon'
         }
       }
     };

     res.json(pricing);
  } catch (error) {
    logger.error(`[Pricing Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to load pricing' });
  }
};


/**
 * Create a checkout session (redirect URL) for a specific variant
 */
export const createCheckoutSession = async (req, res) => {
  try {
      const { variantId, redirectUrl } = req.body;
      const user = req.user;

      if (!user) {
          return res.status(401).json({ message: 'Unauthorized' });
      }

      if (!variantId) {
          return res.status(400).json({ message: 'Variant ID is required' });
      }
      
      
      // Validate Variant ID belongs to our config
      const validVariantIds = [
          process.env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID,
          process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID
      ];
      
      if (!validVariantIds.includes(variantId.toString())) {
          return res.status(400).json({ message: 'Invalid subscription variant' });
      }
      const payload = {
          data: {
              type: "checkouts",
              attributes: {
                  checkout_data: {
                      custom: {
                          user_id: user.snapId || user._id.toString(), // Use SnapID if available
                          tier_name: "pro" // For now only Pro is available
                      }
                  },
                  product_options: {
                      // Redirect back to dashboard after success
                      redirect_url: redirectUrl || `${process.env.CLIENT_URL}/dashboard/settings`,
                  }
              },
              relationships: {
                  store: {
                      data: {
                          type: "stores",
                          id: process.env.LEMONSQUEEZY_STORE_ID
                      }
                  },
                  variant: {
                      data: {
                          type: "variants",
                          id: variantId.toString() 
                      }
                  }
              }
          }
      };
      
      // If user has email, pre-fill it
      if (user.email) {
          payload.data.attributes.checkout_data.email = user.email;
      }
      // If user is already a customer, pass customer_id to avoid dupes?
      // LS handles this if email matches, but ideal to pass if known.
      if (user.subscription?.customerId) {
           // Wait, checkouts endpoint doesn't take customer_id directly in relationships usually?
           // Actually it's better to let LS handle it via email matching 
           // or if using the API strictly we might need to look up documentation.
           // For now, email pre-fill is standard.
      }

      const response = await axios.post('https://api.lemonsqueezy.com/v1/checkouts', payload, {
          headers: {
              'Accept': 'application/vnd.api+json',
              'Content-Type': 'application/vnd.api+json',
              'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`
          }
      });
      
      const checkoutUrl = response.data.data.attributes.url;
      res.json({ url: checkoutUrl });

  } catch (error) {
      logger.error(`[Checkout Error] ${error.message}`);
      // Log response data if available for debugging
      if (error.response) {
          logger.error(`[Checkout Error Data] ${JSON.stringify(error.response.data)}`);
      }
      res.status(500).json({ message: 'Failed to create checkout session' });
  }
};

/**
 * Sync user's own subscription with Lemon Squeezy
 * POST /api/subscription/sync
 */
export const syncSubscription = async (req, res) => {
  try {
    const user = req.user;
    
    if (!user.subscription?.subscriptionId) {
      return res.status(400).json({ 
        message: 'No linked subscription found. If you purchased recently, please wait a few minutes.' 
      });
    }
    
    const subscriptionId = user.subscription.subscriptionId;
    
    try {
      const response = await axios.get(
        `https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`,
        {
          headers: {
            'Accept': 'application/vnd.api+json',
            'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`
          }
        }
      );
      
      const lsData = response.data.data.attributes;
      
      // Map variant to tier
      let tier = 'free';
      const variantId = lsData.variant_id?.toString();
      if (variantId === process.env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID || 
          variantId === process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID) {
        tier = 'pro';
      } else if (variantId === process.env.LEMONSQUEEZY_BUSINESS_MONTHLY_VARIANT_ID || 
                 variantId === process.env.LEMONSQUEEZY_BUSINESS_YEARLY_VARIANT_ID) {
        tier = 'business';
      }
      
      // Refresh portal URL if needed (URLs expire after 24h)
      let portalUrl = lsData.urls?.customer_portal;
      
      // Update user
      await User.findByIdAndUpdate(user._id, {
        $set: {
          'subscription.status': lsData.status,
          'subscription.tier': tier,
          'subscription.currentPeriodStart': new Date(lsData.created_at),
          'subscription.currentPeriodEnd': new Date(lsData.renews_at || lsData.ends_at),
          'subscription.customerPortalUrl': portalUrl,
          'subscription.updatePaymentUrl': lsData.urls?.update_payment_method
        }
      });
      
      logger.info(`[Sync] User ${user.snapId} synced their subscription`);
      
      res.json({
        message: 'Subscription synced successfully',
        status: lsData.status,
        tier,
        renewsAt: lsData.renews_at
      });
      
    } catch (lsError) {
      logger.error(`[Sync LS Error] ${lsError.response?.data || lsError.message}`);
      return res.status(400).json({ 
        message: 'Could not sync with payment provider. Please try again later.' 
      });
    }
    
  } catch (error) {
    logger.error(`[Sync Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to sync subscription' });
  }
};

