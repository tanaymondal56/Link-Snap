import User from '../models/User.js';
import RedeemCode from '../models/RedeemCode.js';
import Url from '../models/Url.js';
import Analytics from '../models/Analytics.js';
import Settings from '../models/Settings.js';
import Session from '../models/Session.js';
import { nanoid } from 'nanoid';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';
import crypto from 'crypto';

// ============================================
// RANDOM DATA GENERATORS FOR SIGNUP TESTING
// ============================================

const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Cameron', 'Dakota', 'Skyler', 'Blake', 'Drew', 'Hayden', 'Jamie', 'Kendall', 'Logan', 'Parker', 'Reese', 'Sam'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'White', 'Harris', 'Clark', 'Lewis'];
const COMPANIES = ['TechCorp', 'DevStudio', 'StartupHub', 'CloudNine', 'DataFlow', 'CodeCraft', 'ByteWorks', 'PixelLab', 'WebForge', 'AppNest', null];
const DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'proton.me', 'icloud.com', 'fastmail.com'];

const randomFrom = (arr) => arr[crypto.randomInt(0, arr.length)];
const randomPhone = () => `+1${crypto.randomInt(2000000000, 9999999999)}`;
const randomWebsite = (company) => company ? `https://${company.toLowerCase().replace(/\s/g, '')}.com` : null;

/**
 * Dev: Get random signup info for testing new registration
 * GET /api/dev/signup-info/random
 */
export const devGetRandomSignupInfo = async (req, res) => {
  try {
    const firstName = randomFrom(FIRST_NAMES);
    const lastName = randomFrom(LAST_NAMES);
    const suffix = nanoid(6).toLowerCase();
    const domain = randomFrom(DOMAINS);
    const company = randomFrom(COMPANIES);
    
    const signupInfo = {
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${suffix}@${domain}`,
      password: 'Test123!@#',
      confirmPassword: 'Test123!@#',
      firstName,
      lastName,
      username: `${firstName.toLowerCase()}${suffix}`,
      phone: randomPhone(),
      company: company,
      website: randomWebsite(company)
    };
    
    logger.info(`[DEV] Generated random signup info: ${signupInfo.email}`);
    res.json({
      message: 'Random signup info generated',
      info: signupInfo,
      note: 'Use this to test NEW user registration'
    });
  } catch (error) {
    logger.error(`[Dev Random Signup Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to generate signup info', error: error.message });
  }
};

/**
 * Dev: Get existing user info for testing duplicate/recurring signup prevention
 * GET /api/dev/signup-info/existing
 */
export const devGetExistingSignupInfo = async (req, res) => {
  try {
    // Find an existing verified user to test duplicate prevention
    let existingUser = await User.findOne({ 
      isVerified: true, 
      email: { $regex: /@dev\.local$|@test\.com$|@gmail\.com$/ } 
    }).select('email firstName lastName username phone company website isVerified');
    
    // If no test user exists, find any verified user
    if (!existingUser) {
      existingUser = await User.findOne({ isVerified: true })
        .select('email firstName lastName username phone company website isVerified');
    }
    
    // If still no user, create a persistent test user
    if (!existingUser) {
      const { generateUserIdentity } = await import('../services/idService.js');
      const identity = await generateUserIdentity(false);
      
      existingUser = await User.create({
        email: 'existing.user@test.com',
        username: 'existing_test_user',
        password: 'Test123!@#',
        firstName: 'Existing',
        lastName: 'TestUser',
        isVerified: true,
        isActive: true,
        eliteId: identity.eliteId,
        snapId: identity.snapId,
        idTier: identity.idTier,
        idNumber: identity.idNumber
      });
      
      logger.info(`[DEV] Created persistent test user: ${existingUser.email}`);
    }
    
    const signupInfo = {
      email: existingUser.email,
      password: 'Test123!@#',
      confirmPassword: 'Test123!@#',
      firstName: existingUser.firstName || 'Existing',
      lastName: existingUser.lastName || 'User',
      username: `${existingUser.username}_new_${nanoid(4)}`, // Different username to avoid that error
      phone: existingUser.phone || randomPhone(),
      company: existingUser.company || 'TestCorp',
      website: existingUser.website || 'https://testcorp.com'
    };
    
    logger.info(`[DEV] Returning existing user signup info: ${signupInfo.email}`);
    res.json({
      message: 'Existing user signup info retrieved',
      info: signupInfo,
      note: 'Use this to test DUPLICATE signup prevention (accountExistsEmail)',
      existingUser: {
        id: existingUser._id,
        email: existingUser.email,
        isVerified: existingUser.isVerified
      }
    });
  } catch (error) {
    logger.error(`[Dev Existing Signup Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to get existing user info', error: error.message });
  }
};

/**
 * Dev: Get unverified user info for testing resend verification flow
 * GET /api/dev/signup-info/unverified
 */
export const devGetUnverifiedSignupInfo = async (req, res) => {
  try {
    // Find an existing unverified user
    let unverifiedUser = await User.findOne({ isVerified: false })
      .select('email firstName lastName username phone company website isVerified');
    
    // If no unverified user exists, create one
    if (!unverifiedUser) {
      const { generateUserIdentity } = await import('../services/idService.js');
      const identity = await generateUserIdentity(false);
      const suffix = nanoid(6).toLowerCase();
      
      unverifiedUser = await User.create({
        email: `unverified.${suffix}@test.com`,
        username: `unverified_${suffix}`,
        password: 'Test123!@#',
        firstName: 'Unverified',
        lastName: 'TestUser',
        isVerified: false,
        isActive: true,
        eliteId: identity.eliteId,
        snapId: identity.snapId,
        idTier: identity.idTier,
        idNumber: identity.idNumber,
        otp: '123456',
        otpExpires: new Date(Date.now() + 10 * 60 * 1000),
        verificationToken: nanoid(32),
        verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      
      logger.info(`[DEV] Created unverified test user: ${unverifiedUser.email}`);
    }
    
    const signupInfo = {
      email: unverifiedUser.email,
      password: 'Test123!@#',
      confirmPassword: 'Test123!@#',
      firstName: unverifiedUser.firstName || 'Unverified',
      lastName: unverifiedUser.lastName || 'User',
      username: unverifiedUser.username,
      phone: unverifiedUser.phone || randomPhone(),
      company: unverifiedUser.company || 'TestCorp',
      website: unverifiedUser.website || 'https://testcorp.com'
    };
    
    logger.info(`[DEV] Returning unverified user signup info: ${signupInfo.email}`);
    res.json({
      message: 'Unverified user signup info retrieved',
      info: signupInfo,
      note: 'Use this to test RESEND VERIFICATION flow (re-register with unverified email)',
      unverifiedUser: {
        id: unverifiedUser._id,
        email: unverifiedUser.email,
        isVerified: unverifiedUser.isVerified
      }
    });
  } catch (error) {
    logger.error(`[Dev Unverified Signup Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to get unverified user info', error: error.message });
  }
};

// ============================================
// DEV STATUS & HEALTH
// ============================================

/**
 * Dev: Get development status and quick stats
 * GET /api/dev/status
 */
export const devStatus = async (req, res) => {
  try {
    const user = req.user;
    const [userCount, urlCount, analyticsCount, sessionCount, settings] = await Promise.all([
      User.countDocuments(),
      Url.countDocuments(),
      Analytics.estimatedDocumentCount(),
      Session.countDocuments({ userId: user._id }),
      Settings.findOne().lean()
    ]);

    res.json({
      status: 'ok',
      mode: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        tier: user.subscription?.tier || 'free',
        isVerified: user.isVerified,
        activeSessions: sessionCount
      },
      database: {
        connected: mongoose.connection.readyState === 1,
        users: userCount,
        urls: urlCount,
        analytics: analyticsCount
      },
      settings: {
        requireEmailVerification: settings?.requireEmailVerification ?? true,
        emailConfigured: settings?.emailConfigured ?? false,
        maintenanceMode: settings?.maintenanceMode ?? false
      },
      features: {
        devRoutes: true,
        quickLogin: true,
        autoVerify: true,
        bulkLinks: true
      }
    });
  } catch (error) {
    logger.error(`[Dev Status Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to get dev status', error: error.message });
  }
};

/**
 * Dev: Quick login as test user (creates if not exists, returns tokens directly)
 * POST /api/dev/quick-login
 * Body: { email?: string, role?: 'user' | 'admin' }
 */
export const devQuickLogin = async (req, res) => {
  try {
    const { email = 'dev@test.com', role = 'user' } = req.body;
    
    // Import token utils dynamically to avoid circular dependencies
    const { generateAccessToken } = await import('../utils/generateToken.js');
    const { createSession } = await import('../utils/sessionHelper.js');
    const { generateUserIdentity } = await import('../services/idService.js');
    
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Create test user with identity
      const identity = await generateUserIdentity(role === 'admin');
      user = await User.create({
        email: email.toLowerCase(),
        username: `dev_${nanoid(6)}`,
        password: 'Dev123!@#',
        firstName: 'Dev',
        lastName: 'User',
        isVerified: true,
        isActive: true,
        role,
        eliteId: identity.eliteId,
        snapId: identity.snapId,
        idTier: identity.idTier,
        idNumber: identity.idNumber,
        subscription: role === 'admin' ? {
          tier: 'pro',
          status: 'active',
          variantId: 'DEV-ADMIN'
        } : undefined
      });
      logger.info(`[DEV] Created quick-login user: ${email} (${role})`);
    }
    
    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const { refreshToken } = await createSession(user._id, req);
    
    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    
    logger.info(`[DEV] Quick login: ${user.email}`);
    
    res.json({
      message: `Logged in as ${user.email}`,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        isVerified: user.isVerified,
        subscription: user.subscription
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    logger.error(`[Dev Quick Login Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to quick login', error: error.message });
  }
};

/**
 * Dev: Auto-verify current user's email
 * POST /api/dev/verify-self
 */
export const devVerifySelf = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 
        isVerified: true,
        otp: null,
        otpExpires: null,
        verificationToken: null,
        verificationTokenExpires: null
      },
      { new: true }
    ).select('-password');
    
    logger.info(`[DEV] User ${user.email} self-verified`);
    res.json({ message: 'Email verified', user });
  } catch (error) {
    logger.error(`[Dev Verify Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to verify', error: error.message });
  }
};

/**
 * Dev: Toggle email verification requirement
 * POST /api/dev/toggle-verification
 */
export const devToggleVerification = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    
    settings.requireEmailVerification = !settings.requireEmailVerification;
    await settings.save();
    
    logger.info(`[DEV] Email verification ${settings.requireEmailVerification ? 'enabled' : 'disabled'}`);
    res.json({ 
      message: `Email verification ${settings.requireEmailVerification ? 'enabled' : 'disabled'}`,
      requireEmailVerification: settings.requireEmailVerification
    });
  } catch (error) {
    logger.error(`[Dev Toggle Verification Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to toggle', error: error.message });
  }
};

/**
 * Dev: Clear all sessions for current user
 * DELETE /api/dev/sessions
 */
export const devClearSessions = async (req, res) => {
  try {
    const result = await Session.deleteMany({ userId: req.user._id });
    logger.info(`[DEV] Cleared ${result.deletedCount} sessions for ${req.user.email}`);
    res.json({ message: `Cleared ${result.deletedCount} sessions`, deletedCount: result.deletedCount });
  } catch (error) {
    logger.error(`[Dev Clear Sessions Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to clear sessions', error: error.message });
  }
};

/**
 * Dev: Seed test users
 * POST /api/dev/seed-users
 * Body: { count?: number }
 */
export const devSeedUsers = async (req, res) => {
  try {
    const count = Math.min(Math.max(parseInt(req.body.count) || 5, 1), 50);
    const { generateUserIdentity } = await import('../services/idService.js');
    
    const users = [];
    for (let i = 0; i < count; i++) {
      const identity = await generateUserIdentity(false);
      const suffix = nanoid(6);
      users.push({
        email: `testuser${suffix}@dev.local`,
        username: `testuser_${suffix}`,
        password: 'Test123!@#',
        firstName: `Test${i + 1}`,
        lastName: 'User',
        isVerified: true,
        isActive: true,
        eliteId: identity.eliteId,
        snapId: identity.snapId,
        idTier: identity.idTier,
        idNumber: identity.idNumber
      });
    }
    
    const created = await User.insertMany(users, { ordered: false }).catch(e => e.insertedDocs || []);
    logger.info(`[DEV] Seeded ${created.length} test users`);
    
    res.json({ 
      message: `Created ${created.length} test users`,
      count: created.length,
      sample: created.slice(0, 3).map(u => ({ email: u.email, username: u.username }))
    });
  } catch (error) {
    logger.error(`[Dev Seed Users Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to seed users', error: error.message });
  }
};

/**
 * Dev: Delete all test users (by email pattern)
 * DELETE /api/dev/seed-users
 */
export const devDeleteTestUsers = async (req, res) => {
  try {
    const result = await User.deleteMany({ email: { $regex: /@dev\.local$/ } });
    logger.info(`[DEV] Deleted ${result.deletedCount} test users`);
    res.json({ message: `Deleted ${result.deletedCount} test users`, deletedCount: result.deletedCount });
  } catch (error) {
    logger.error(`[Dev Delete Test Users Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to delete test users', error: error.message });
  }
};

/**
 * Dev: Generate analytics for user's links
 * POST /api/dev/generate-analytics
 * Body: { count?: number, linkId?: string }
 */
export const devGenerateAnalytics = async (req, res) => {
  try {
    const user = req.user;
    const count = Math.min(Math.max(parseInt(req.body.count) || 100, 1), 1000);
    const { linkId } = req.body;
    
    // Get target links
    let links;
    if (linkId) {
      if (!mongoose.Types.ObjectId.isValid(linkId)) {
        return res.status(400).json({ message: 'Invalid linkId format' });
      }
      const link = await Url.findOne({ _id: linkId, createdBy: user._id });
      links = link ? [link] : [];
    } else {
      links = await Url.find({ createdBy: user._id }).limit(10);
    }
    
    if (links.length === 0) {
      return res.status(400).json({ message: 'No links found to generate analytics for' });
    }
    
    const countries = ['US', 'GB', 'DE', 'FR', 'IN', 'JP', 'BR', 'CA', 'AU', 'MX'];
    const cities = ['New York', 'London', 'Berlin', 'Paris', 'Mumbai', 'Tokyo', 'São Paulo', 'Toronto', 'Sydney', 'Mexico City'];
    const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera'];
    const devices = ['desktop', 'mobile', 'tablet'];
    const oses = ['Windows', 'macOS', 'Linux', 'iOS', 'Android'];
    const referrers = ['https://google.com', 'https://twitter.com', 'https://facebook.com', 'https://linkedin.com', 'direct'];
    
    const analyticsData = [];
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    
    for (let i = 0; i < count; i++) {
        const link = links[crypto.randomInt(0, links.length)];
        const countryIdx = crypto.randomInt(0, countries.length);
        
        // Random time within last 30 days
        // crypto.randomInt only takes integer max, so we get a random offset up to the full duration
        const timeOffset = crypto.randomInt(0, now - thirtyDaysAgo);
        
        analyticsData.push({
          urlId: link._id,
          timestamp: new Date(thirtyDaysAgo + timeOffset),
          ip: `192.168.${crypto.randomInt(0, 256)}.${crypto.randomInt(0, 256)}`,
          country: countries[countryIdx],
          city: cities[countryIdx],
          browser: browsers[crypto.randomInt(0, browsers.length)],
          browserVersion: `${crypto.randomInt(50, 150)}.0`,
          device: devices[crypto.randomInt(0, devices.length)],
          os: oses[crypto.randomInt(0, oses.length)],
          referrer: referrers[crypto.randomInt(0, referrers.length)]
        });
      }
    
    const inserted = await Analytics.insertMany(analyticsData, { ordered: false });
    
    // Update click counts on links
    const linkClickMap = {};
    for (const a of analyticsData) {
      linkClickMap[a.urlId.toString()] = (linkClickMap[a.urlId.toString()] || 0) + 1;
    }
    
    await Promise.all(
      Object.entries(linkClickMap).map(([id, clicks]) =>
        Url.findByIdAndUpdate(id, { $inc: { clicks } })
      )
    );
    
    logger.info(`[DEV] Generated ${inserted.length} analytics records for ${user.email}`);
    res.json({ 
      message: `Generated ${inserted.length} analytics records across ${Object.keys(linkClickMap).length} links`,
      count: inserted.length,
      linksAffected: Object.keys(linkClickMap).length
    });
  } catch (error) {
    logger.error(`[Dev Generate Analytics Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to generate analytics', error: error.message });
  }
};

/**
 * Dev: Clear all analytics for current user's links
 * DELETE /api/dev/analytics
 */
export const devClearAnalytics = async (req, res) => {
  try {
    const user = req.user;
    const links = await Url.find({ createdBy: user._id }).select('_id');
    const linkIds = links.map(l => l._id);
    
    const result = await Analytics.deleteMany({ urlId: { $in: linkIds } });
    
    // Reset click counts
    await Url.updateMany({ _id: { $in: linkIds } }, { $set: { clicks: 0 } });
    
    logger.info(`[DEV] Cleared ${result.deletedCount} analytics for ${user.email}`);
    res.json({ 
      message: `Cleared ${result.deletedCount} analytics records`,
      deletedCount: result.deletedCount,
      linksReset: links.length
    });
  } catch (error) {
    logger.error(`[Dev Clear Analytics Error] ${error.message}`);
    res.status(500).json({ message: 'Failed to clear analytics', error: error.message });
  }
};

// ============================================
// EXISTING FUNCTIONS (SUBSCRIPTION & LINKS)
// ============================================

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

// Note: randomFrom helper is defined at the top of the file

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
