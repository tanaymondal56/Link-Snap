import User from '../models/User.js';
import RedeemCode from '../models/RedeemCode.js';
import Url from '../models/Url.js';
import { nanoid } from 'nanoid';
import logger from '../utils/logger.js';

/**
 * Dev: Upgrade own account to Pro
 * POST /api/dev/subscription/upgrade
 */
export const devUpgradeSelf = async (req, res) => {
  try {
    const user = req.user;
    
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          'subscription.tier': 'pro',
          'subscription.status': 'active',
          'subscription.currentPeriodStart': new Date(),
          'subscription.currentPeriodEnd': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          'subscription.variantId': 'DEV-OVERRIDE',
          'subscription.billingCycle': 'monthly'
        }
      },
      { new: true }
    ).select('-password');

    logger.info(`[DEV] User ${user.email} self-upgraded to PRO via DevTools`);
    
    res.json({ message: 'Dev Mode: Upgraded to Pro', user: updatedUser });
  } catch (error) {
    logger.error(`[Dev Upgrade Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to upgrade' });
  }
};

export const devResetSelf = async (req, res) => {
  try {
    const user = req.user;
    const keepHistory = req.query.keepHistory === 'true';
    
    // 1. Clear user from any Redeem Codes they used ONLY if keepHistory is false
    if (!keepHistory) {
      // Optimized: Use updateMany instead of loop + findByIdAndUpdate (N+1 fix)
      const codesUsed = await RedeemCode.find({ 'usedBy.user': user._id }).select('_id');
      
      if (codesUsed.length > 0) {
        const codeIds = codesUsed.map(c => c._id);
        
        await RedeemCode.updateMany(
          { _id: { $in: codeIds } },
          { 
            $pull: { usedBy: { user: user._id } },
            $inc: { usedCount: -1 }
          }
        );
        
        logger.info(`[DEV] Cleared ${codesUsed.length} redeem code usages for user ${user.email}`);
      }
    } else {
        logger.info(`[DEV] User ${user.email} reset subscription but KEPT redeem history`);
    }

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          'subscription.tier': 'free',
          'subscription.status': 'active',
          'subscription.currentPeriodEnd': null,
          'subscription.subscriptionId': null,
          'subscription.variantId': null,
          'subscription.billingCycle': null
        }
      },
      { new: true }
    ).select('-password');

    logger.info(`[DEV] User ${user.email} self-reset to FREE via DevTools`);
    
    res.json({ message: 'Dev Mode: Reset to Free', user: updatedUser });
  } catch (error) {
    logger.error(`[Dev Reset Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to reset' });
  }
};

/**
 * Dev: Clear Redeem History ONLY (Keep Tier)
 * POST /api/dev/subscription/clear-history
 */
export const devClearRedeemHistory = async (req, res) => {
  try {
    const user = req.user;
    
    // Optimized: Use updateMany instead of loop + findByIdAndUpdate (N+1 fix)
    const codesUsed = await RedeemCode.find({ 'usedBy.user': user._id }).select('_id');
    
    if (codesUsed.length > 0) {
      const codeIds = codesUsed.map(c => c._id);
      
      await RedeemCode.updateMany(
        { _id: { $in: codeIds } },
        { 
          $pull: { usedBy: { user: user._id } },
          $inc: { usedCount: -1 }
        }
      );
      
      logger.info(`[DEV] Cleared ${codesUsed.length} redeem code usages for user ${user.email} (Tier preserved)`);
      return res.json({ message: `Dev Mode: Cleared history for ${codesUsed.length} codes. You can reuse them now.`, count: codesUsed.length });
    }
    
    res.json({ message: 'Dev Mode: No redemption history found to clear.' });
  } catch (error) {
    logger.error(`[Dev History Clear Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to clear history' });
  }
};

// ============================================
// BULK TEST LINK FUNCTIONS
// ============================================

const TEST_LINK_PREFIX = 'devtest-';

// Curated list of real, working destination URLs for test links
const TEST_DESTINATION_URLS = [
  // Popular websites
  'https://www.google.com',
  'https://www.github.com',
  'https://www.youtube.com',
  'https://www.twitter.com',
  'https://www.linkedin.com',
  'https://www.facebook.com',
  'https://www.instagram.com',
  'https://www.reddit.com',
  'https://www.wikipedia.org',
  'https://www.amazon.com',
  // Tech/Dev sites
  'https://stackoverflow.com',
  'https://developer.mozilla.org',
  'https://www.npmjs.com',
  'https://reactjs.org',
  'https://nodejs.org',
  'https://vercel.com',
  'https://www.netlify.com',
  'https://cloudflare.com',
  'https://www.digitalocean.com',
  'https://aws.amazon.com',
  // News/Media
  'https://www.bbc.com',
  'https://www.cnn.com',
  'https://www.nytimes.com',
  'https://www.theguardian.com',
  'https://news.ycombinator.com',
  // Tools/Productivity
  'https://www.notion.so',
  'https://www.figma.com',
  'https://www.canva.com',
  'https://slack.com',
  'https://www.trello.com',
  'https://www.spotify.com',
  'https://www.netflix.com',
  'https://www.twitch.tv',
  // E-commerce
  'https://www.shopify.com',
  'https://www.etsy.com',
  'https://www.ebay.com',
  // Education
  'https://www.coursera.org',
  'https://www.udemy.com',
  'https://www.khanacademy.org',
  // Misc
  'https://www.medium.com',
  'https://www.producthunt.com',
  'https://www.dribbble.com',
  'https://www.behance.net',
  'https://unsplash.com',
  'https://www.pexels.com'
];

// Real app store URLs for device redirects
const DEVICE_REDIRECT_URLS = {
  ios: [
    'https://apps.apple.com/app/spotify-music-and-podcasts/id324684580',
    'https://apps.apple.com/app/instagram/id389801252',
    'https://apps.apple.com/app/youtube-watch-listen-stream/id544007664',
    'https://apps.apple.com/app/twitter/id333903271',
    'https://apps.apple.com/app/tiktok/id835599320'
  ],
  android: [
    'https://play.google.com/store/apps/details?id=com.spotify.music',
    'https://play.google.com/store/apps/details?id=com.instagram.android',
    'https://play.google.com/store/apps/details?id=com.google.android.youtube',
    'https://play.google.com/store/apps/details?id=com.twitter.android',
    'https://play.google.com/store/apps/details?id=com.zhiliaoapp.musically'
  ],
  windows: [
    'https://www.microsoft.com/store/apps/9ncbcszsjrsb',
    'https://www.microsoft.com/store/apps/9wzdncrfj3tj',
    'https://www.microsoft.com/store/apps/9nblggh5l9xt'
  ],
  mac: [
    'https://apps.apple.com/app/xcode/id497799835',
    'https://apps.apple.com/app/final-cut-pro/id424389933',
    'https://apps.apple.com/app/slack-for-desktop/id803453959'
  ],
  linux: [
    'https://snapcraft.io/spotify',
    'https://snapcraft.io/code',
    'https://snapcraft.io/discord'
  ]
};

// Helper to get random item from array
const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Dev: Create test links with ALL options filled (OPTIMIZED FOR BULK)
 * POST /api/dev/links
 * Body: { count: 1-2000 }
 * Uses insertMany for batch insert optimization
 */
// Real bcrypt hash for password '1234' (cost factor 10)
const PASSWORD_HASH_1234 = '$2b$10$ULojCheyrgtrXqoGMkGJKep1FT/YFG5YSntl1TxUVQGM5302YC5I.';

export const devCreateTestLinks = async (req, res) => {
  const startTime = Date.now();
  try {
    const user = req.user;
    const count = Math.min(Math.max(parseInt(req.body.count) || 1, 1), 2000); // Clamp 1-2000
    
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    const BATCH_SIZE = 100; // Insert in batches of 100 to avoid memory issues
    
    // Pre-generate all documents (no DB calls yet)
    const linkDocs = [];
    for (let i = 0; i < count; i++) {
      // Use longer nanoid (12 chars) to minimize collision chance without checking DB
      const alias = `${TEST_LINK_PREFIX}${nanoid(12)}`;
      // Random real URL from curated list
      const destinationUrl = randomFrom(TEST_DESTINATION_URLS);
      
      linkDocs.push({
        originalUrl: destinationUrl,
        shortId: nanoid(8),
        customAlias: alias,
        title: `Dev Test Link #${i + 1}`,
        description: `Auto-generated test link → ${new URL(destinationUrl).hostname}`,
        createdBy: user._id,
        expiresAt: oneHourFromNow,
        // Password always "1234"
        isPasswordProtected: true,
        passwordHash: PASSWORD_HASH_1234,
        // ALL device redirects with real app store URLs
        deviceRedirects: {
          enabled: true,
          rules: [
            { device: 'ios', url: randomFrom(DEVICE_REDIRECT_URLS.ios), priority: 0 },
            { device: 'android', url: randomFrom(DEVICE_REDIRECT_URLS.android), priority: 1 },
            { device: 'desktop', url: randomFrom(DEVICE_REDIRECT_URLS.windows), priority: 2 },
            { device: 'tablet', url: randomFrom(DEVICE_REDIRECT_URLS.mac), priority: 3 },
            { device: 'mobile', url: randomFrom(DEVICE_REDIRECT_URLS.android), priority: 4 }
          ]
        },
        // 4 time redirect rules with 6-hour gaps
        timeRedirects: {
          enabled: true,
          timezone: 'Asia/Kolkata',
          rules: [
            { 
              startTime: '00:00', 
              endTime: '06:00', 
              days: [0, 1, 2, 3, 4, 5, 6], // All days
              destination: randomFrom(TEST_DESTINATION_URLS),
              priority: 0,
              label: 'Night (12AM-6AM)'
            },
            { 
              startTime: '06:00', 
              endTime: '12:00', 
              days: [0, 1, 2, 3, 4, 5, 6],
              destination: randomFrom(TEST_DESTINATION_URLS),
              priority: 1,
              label: 'Morning (6AM-12PM)'
            },
            { 
              startTime: '12:00', 
              endTime: '18:00', 
              days: [0, 1, 2, 3, 4, 5, 6],
              destination: randomFrom(TEST_DESTINATION_URLS),
              priority: 2,
              label: 'Afternoon (12PM-6PM)'
            },
            { 
              startTime: '18:00', 
              endTime: '23:59', 
              days: [0, 1, 2, 3, 4, 5, 6],
              destination: randomFrom(TEST_DESTINATION_URLS),
              priority: 3,
              label: 'Evening (6PM-12AM)'
            }
          ]
        }
      });
    }
    
    
    // Batch insert for performance
    const createdLinks = [];
    const errors = [];
    
    for (let i = 0; i < linkDocs.length; i += BATCH_SIZE) {
      const batch = linkDocs.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      
      try {
        const inserted = await Url.insertMany(batch, { ordered: false });
        createdLinks.push(...inserted);
      } catch (error) {
        console.log(`\n❌ Batch ${batchNum} ERROR CAUGHT:`);
        console.log(`Error name: ${error.name}`);
        console.log(`Error message: ${error.message}`);
        console.log(`Error code: ${error.code}`);
        console.log(`WriteErrors count: ${error.writeErrors?.length || 0}`);
        console.log(`Has insertedDocs: ${!!error.insertedDocs}`);
        console.log(`insertedDocs length: ${error.insertedDocs?.length || 0}`);
        console.log(`Has result: ${!!error.result}`);
        console.log(`Result nInserted: ${error.result?.nInserted}`);
        
        if (error.writeErrors && error.writeErrors.length > 0) {
          console.log(`First write error:`, error.writeErrors[0]);
        }
        
        // Mongoose insertMany with ordered: false throws error but may have inserted some docs
        logger.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, {
          name: error.name,
          message: error.message,
          writeErrorsCount: error.writeErrors?.length,
          insertedCount: error.result?.nInserted,
          hasInsertedDocs: !!error.insertedDocs,
          insertedDocsLength: error.insertedDocs?.length
        });
        
        // Try multiple ways to get inserted documents
        let inserted = [];
        if (error.insertedDocs && error.insertedDocs.length > 0) {
          inserted = error.insertedDocs;
        } else if (error.result?.insertedIds) {
          // Fallback: query database for the inserted IDs
          const insertedIds = Object.values(error.result.insertedIds);
          if (insertedIds.length > 0) {
            inserted = await Url.find({ _id: { $in: insertedIds } });
          }
        }
        
        if (inserted.length > 0) {
          createdLinks.push(...inserted);
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${inserted.length} created, ${error.writeErrors?.length || 0} failed`);
        } else {
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        }
      }
    }
    
    const duration = Date.now() - startTime;
    logger.info(`[DEV] User ${user.email} created ${createdLinks.length}/${linkDocs.length} test links in ${duration}ms${errors.length ? ` (${errors.length} batches had errors)` : ''}`);
    
    if (errors.length > 0) {
      logger.warn(`[DEV] Errors during bulk insert: ${errors.join('; ')}`);
    }
    
    // Return summary (not all links to avoid huge response)
    res.json({ 
      message: `Created ${createdLinks.length} test links`, 
      count: createdLinks.length,
      requested: linkDocs.length,
      duration,
      password: '1234',
      errors: errors.length > 0 ? errors : undefined,
      links: createdLinks.slice(0, 10).map(l => ({
        _id: l._id,
        shortId: l.shortId,
        alias: l.customAlias,
        title: l.title
      })),
      truncated: createdLinks.length > 10
    });
  } catch (error) {
    logger.error(`[Dev Create Links Error] ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: 'Failed to create test links', error: error.message });
  }
};

/**
 * Dev: Get all test links (by prefix)
 * GET /api/dev/links
 */
export const devGetTestLinks = async (req, res) => {
  try {
    const user = req.user;
    
    const links = await Url.find({
      createdBy: user._id,
      customAlias: { $regex: `^${TEST_LINK_PREFIX}` }
    })
      .select('_id shortId customAlias title createdAt expiresAt')
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json({ count: links.length, links });
  } catch (error) {
    logger.error(`[Dev Get Links Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to fetch test links' });
  }
};

/**
 * Dev: Delete all test links (by prefix) - OPTIMIZED FOR BULK
 * DELETE /api/dev/links
 */
export const devDeleteTestLinks = async (req, res) => {
  const startTime = Date.now();
  try {
    const user = req.user;
    
    // deleteMany is already highly optimized for bulk operations
    const result = await Url.deleteMany({
      createdBy: user._id,
      customAlias: { $regex: `^${TEST_LINK_PREFIX}` }
    });
    
    const duration = Date.now() - startTime;
    logger.info(`[DEV] User ${user.email} deleted ${result.deletedCount} test links in ${duration}ms`);
    res.json({ 
      message: `Deleted ${result.deletedCount} test links`, 
      deletedCount: result.deletedCount,
      duration 
    });
  } catch (error) {
    logger.error(`[Dev Delete Links Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to delete test links', error: error.message });
  }
};
