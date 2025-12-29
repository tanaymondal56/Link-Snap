import User from '../models/User.js';
import Url from '../models/Url.js';
import logger from '../utils/logger.js';

// Valid theme values (must match schema enum)
const VALID_THEMES = ['default', 'dark', 'midnight', 'ocean', 'forest', 'sunset', 'custom'];

// Valid button styles
const VALID_BUTTON_STYLES = ['rounded', 'pill', 'square'];

// Hex color pattern for custom theme validation
const HEX_COLOR_PATTERN = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

// Safe image URL pattern (allows common image hosts and formats)
const SAFE_IMAGE_URL_PATTERN = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;

// Basic HTML/script sanitization
const sanitizeText = (text) => {
  if (!text) return text;
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

// Validate and sanitize custom theme colors
const validateCustomTheme = (customTheme) => {
  if (!customTheme || typeof customTheme !== 'object') return null;
  
  const validated = {};
  const colorFields = ['background', 'textColor', 'buttonColor', 'buttonTextColor'];
  
  for (const [key, value] of Object.entries(customTheme)) {
    if (colorFields.includes(key)) {
      // Validate hex colors
      if (typeof value === 'string' && HEX_COLOR_PATTERN.test(value)) {
        validated[key] = value;
      }
    } else if (key === 'buttonStyle') {
      // Validate button style enum
      if (VALID_BUTTON_STYLES.includes(value)) {
        validated[key] = value;
      }
    }
  }
  
  return Object.keys(validated).length > 0 ? validated : null;
};

// @desc    Get public profile for bio page
// @route   GET /api/bio/:username
// @access  Public
export const getPublicProfile = async (req, res) => {
  try {
    const { username } = req.params;
    
    // Validate username parameter
    if (!username || username.length < 3 || username.length > 30) {
      return res.status(400).json({ message: 'Invalid username' });
    }
    
    // Find user by username (case insensitive)
    const user = await User.findOne({ username: username.toLowerCase() })
      .select('username bioPage isVerified eliteId idTier avatar firstName lastName isActive subscription')
      .populate({
        path: 'bioPage.pinnedLinks',
        match: { isActive: true }, // Only active links
        select: 'title originalUrl shortId customAlias clicks'
      });
    
    if (!user) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    // Check if user is banned
    if (!user.isActive) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    // Check if profile is enabled
    if (!user.bioPage?.isEnabled) {
      return res.status(404).json({ message: 'This profile is private' });
    }
    
    // Filter out any null refs (deleted links)
    const pinnedLinks = (user.bioPage?.pinnedLinks || []).filter(Boolean);
    
    // Determine subscription status for badge/ad
    const subTier = user.subscription?.tier || 'free';
    const subStatus = user.subscription?.status;
    const hadSubscription = !!user.subscription?.subscriptionId; // Ever had a paid subscription
    
    // isPro: ONLY show badge if tier is pro/business AND status is STRICTLY active or on_trial
    // cancelled, expired, past_due, paused should NOT show Pro badge
    const isActiveSub = subStatus === 'active' || subStatus === 'on_trial';
    const isPro = ['pro', 'business'].includes(subTier) && isActiveSub;
    
    // isExpired: Previously had a subscription but it's no longer showing as Pro
    // This covers: cancelled, expired, past_due, paused, manual downgrade (tier=free), etc.
    const isExpired = hadSubscription && !isPro;

    console.log(`[Bio Debug] User: ${username} | Tier: ${subTier} | Status: ${subStatus} | isPro: ${isPro} | isExpired: ${isExpired} | LinksURL: ${pinnedLinks[0]?.originalUrl ? 'Visible' : 'Hidden'}`);
    

    
    // Build response with only public fields
    res.json({
      username: user.username,
      displayName: user.bioPage?.displayName || user.firstName || user.username,
      bio: user.bioPage?.bio || '',
      avatar: user.bioPage?.avatarUrl || user.avatar || null,
      isVerified: user.isVerified || false,
      eliteId: user.eliteId || null,
      idTier: user.idTier || null,
      subscriptionTier: user.subscription?.tier || 'free',
      theme: user.bioPage?.theme || 'default',
      customTheme: user.bioPage?.customTheme || null,
      socials: user.bioPage?.socials || {},
      isPro, // Show Pro badge
      isExpired, // Show subtle ad for expired subs
      links: pinnedLinks.slice(0, 25).map(link => ({
        id: link._id,
        title: link.title || link.shortId,
        // url is NOT sent to hide original URL from public endpoint
        shortCode: link.customAlias || link.shortId, // For display and construction
        clicks: link.clicks
      })),
      lastUpdatedAt: user.bioPage?.lastUpdatedAt || null
    });
    
  } catch (error) {
    logger.error(`[Bio] Error fetching profile: ${error.message}`);
    res.status(500).json({ message: 'Failed to load profile' });
  }
};

// @desc    Get current user's bio settings
// @route   GET /api/bio/me
// @access  Private
export const getBioSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('username bioPage avatar firstName lastName')
      .populate({
        path: 'bioPage.pinnedLinks',
        select: 'title originalUrl shortId customAlias isActive clicks'
      });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get all user's links for the link picker
    const allLinks = await Url.find({ createdBy: req.user._id, isActive: true })
      .select('title originalUrl shortId customAlias clicks createdAt')
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json({
      bioPage: user.bioPage || { isEnabled: true, theme: 'default' },
      allLinks,
      username: user.username,
      defaultDisplayName: user.firstName || user.username,
      defaultAvatar: user.avatar
    });
    
  } catch (error) {
    logger.error(`[Bio] Error fetching settings: ${error.message}`);
    res.status(500).json({ message: 'Failed to load settings' });
  }
};

// @desc    Update bio page settings
// @route   PUT /api/bio/me
// @access  Private
export const updateBioSettings = async (req, res) => {
  try {
    const { 
      isEnabled, 
      displayName, 
      bio, 
      avatarUrl, 
      theme, 
      customTheme, 
      socials, 
      pinnedLinks 
    } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Initialize bioPage if not exists
    if (!user.bioPage) {
      user.bioPage = {};
    }
    
    // Update fields if provided
    if (typeof isEnabled === 'boolean') user.bioPage.isEnabled = isEnabled;
    if (displayName !== undefined) user.bioPage.displayName = sanitizeText(displayName?.slice(0, 50));
    if (bio !== undefined) user.bioPage.bio = sanitizeText(bio?.slice(0, 160));
    if (avatarUrl !== undefined) {
      // Validate avatar URL pattern (empty string allowed to clear)
      if (avatarUrl === '' || SAFE_IMAGE_URL_PATTERN.test(avatarUrl)) {
        user.bioPage.avatarUrl = avatarUrl;
      } else {
        logger.warn(`[Bio] Invalid avatar URL attempted by ${user.username}: ${avatarUrl}`);
      }
    }
    // Only accept valid themes
    if (theme !== undefined && VALID_THEMES.includes(theme)) {
      user.bioPage.theme = theme;
    }
    if (customTheme !== undefined) {
      const validatedTheme = validateCustomTheme(customTheme);
      if (validatedTheme) {
        user.bioPage.customTheme = validatedTheme;
      }
    }
    if (socials !== undefined && typeof socials === 'object') {
      // Sanitize all social link values
      const sanitizedSocials = {};
      for (const [key, value] of Object.entries(socials)) {
        if (typeof value === 'string') {
          sanitizedSocials[key] = sanitizeText(value.slice(0, 200));
        }
      }
      user.bioPage.socials = sanitizedSocials;
    }
    
    // Handle pinned links
    if (pinnedLinks !== undefined && Array.isArray(pinnedLinks)) {
      // Validate that all links belong to user
      const userLinks = await Url.find({ 
        _id: { $in: pinnedLinks }, 
        createdBy: req.user._id 
      }).select('_id');
      
      const validIds = userLinks.map(l => l._id.toString());
      const filteredLinks = pinnedLinks.filter(id => validIds.includes(id));
      
      // Apply tier limits
      const tier = user.subscription?.tier || 'free';
      const maxLinks = tier === 'free' ? 10 : 25;
      user.bioPage.pinnedLinks = filteredLinks.slice(0, maxLinks);
    }
    
    user.bioPage.lastUpdatedAt = new Date();
    await user.save();
    
    logger.info(`[Bio] User ${user.username} updated their bio page`);
    
    res.json({ 
      message: 'Bio page updated successfully',
      bioPage: user.bioPage
    });
    
  } catch (error) {
    logger.error(`[Bio] Error updating settings: ${error.message}`);
    res.status(500).json({ message: 'Failed to update settings' });
  }
};

// @desc    Toggle bio page visibility
// @route   PATCH /api/bio/me/toggle
// @access  Private
export const toggleBioVisibility = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!user.bioPage) {
      user.bioPage = { isEnabled: false };
    } else {
      user.bioPage.isEnabled = !user.bioPage.isEnabled;
    }
    
    await user.save();
    
    res.json({ 
      isEnabled: user.bioPage.isEnabled,
      message: user.bioPage.isEnabled ? 'Bio page is now public' : 'Bio page is now private'
    });
    
  } catch (error) {
    logger.error(`[Bio] Error toggling visibility: ${error.message}`);
    res.status(500).json({ message: 'Failed to toggle visibility' });
  }
};
