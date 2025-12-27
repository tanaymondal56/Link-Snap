import User from '../models/User.js';
import Settings from '../models/Settings.js';
import Session from '../models/Session.js';
import LoginHistory from '../models/LoginHistory.js';
import UsernameHistory from '../models/UsernameHistory.js';
import { generateAccessToken, generateRefreshToken } from '../utils/generateToken.js';
import { createSession, validateSession, refreshSessionActivity, terminateSession, hashToken, terminateAllUserSessions } from '../utils/sessionHelper.js';
import { registerSchema, loginSchema, updateProfileSchema, verifyOtpSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/authValidator.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import sendEmail from '../utils/sendEmail.js';
import { welcomeEmail, verificationEmail, accountExistsEmail, passwordResetEmail } from '../utils/emailTemplates.js';
import { isReservedWord } from '../config/reservedWords.js';
import logger from '../utils/logger.js';
import { generateUserIdentity } from '../services/idService.js';

// Cookie settings - use 'strict' for permanent domains, 'lax' for tunnels/dev
// Set COOKIE_SAMESITE=lax in .env if using temporary tunnels
const getCookieSameSite = () => {
  if (process.env.COOKIE_SAMESITE) {
    return process.env.COOKIE_SAMESITE;
  }
  // Default: strict for production (most secure), lax for development
  return process.env.NODE_ENV === 'production' ? 'strict' : 'lax';
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
  try {
    // Note: Zod schema validation for username should ideally be added to authValidator.js
    // For now, we manually validate or rely on DB validation, but it's cleaner to add to schema
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400);
      throw new Error(result.error.errors[0].message);
    }

    const { email, password, firstName, lastName, phone, company, website, username } = result.data;

    // Validate username if provided (required by schema update, but handle safely)
    if (!username) {
        res.status(400);
        throw new Error('Username is required');
    }

    // Check reserved words
    if (isReservedWord(username)) {
        res.status(400);
        throw new Error('This username is not available');
    }

    // Check format (double check in controller)
    if (!/^[a-z0-9_-]+$/.test(username)) {
        res.status(400);
        throw new Error('Username must be alphanumeric (letters, numbers, _, -)');
    }

    // Check for existing user by email
    const userExists = await User.findOne({ email });

    // Check for existing user by username
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
        res.status(400);
        // Explicitly reveal this error as it's a public conflict check
        throw new Error('Username is already taken');
    }

    // SECURITY: Return generic message to prevent email enumeration attacks
    // Don't reveal whether the email is already registered
    if (userExists) {
      if (userExists.isVerified) {
        // Option 1: User is already verified - Send "Account Exists" email
        console.log(`Registration attempt for existing verified user: ${email}`);
        
        try {
          const emailContent = accountExistsEmail(userExists);
          await sendEmail({
            email: userExists.email,
            subject: emailContent.subject,
            message: emailContent.html,
          });
        } catch (error) {
          console.error('Failed to send account exists email:', error);
          // Don't error out, just continue to return the generic message
        }
      } else {
        // Option 2: User exists but is unverified - Update their info and Resend Verification Email
        console.log(`Registration attempt for existing unverified user: ${email}`);
        
        // Update user profile with new form data (in case they changed password/name)
        userExists.password = password; // Will be hashed by pre-save hook
        if (firstName) userExists.firstName = firstName;
        if (lastName) userExists.lastName = lastName;
        if (phone) userExists.phone = phone;
        if (company) userExists.company = company;
        if (website) userExists.website = website;
        // Don't update username for existing user unless they are re-registering unverified? 
        // Logic: if unverified, they effectively own the account slot, so maybe update it?
        // Let's allow updating it if they are unverified.
        if (username) userExists.username = username;
        
        // Generate new tokens
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationToken = crypto.randomBytes(20).toString('hex');
        const otpExpiresTime = Date.now() + 10 * 60 * 1000; // 10 minutes
        
        userExists.otp = otp;
        userExists.otpExpires = otpExpiresTime;
        userExists.verificationToken = verificationToken;
        userExists.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
        
        // Debug: Log before save
        console.log('[DEBUG] Before save - OTP:', otp, 'Expires:', new Date(otpExpiresTime).toISOString());
        
        await userExists.save();
        
        // Debug: Verify saved data by re-fetching
        const savedUser = await User.findOne({ email });
        console.log('[DEBUG] After save - OTP:', savedUser.otp, 'Expires:', savedUser.otpExpires, 'Now:', Date.now());
        console.log('[DEBUG] OTP Match:', savedUser.otp === otp, 'Expires Valid:', savedUser.otpExpires > Date.now());

        try {
          const emailContent = verificationEmail(userExists, verificationToken, otp);
          await sendEmail({
            email: userExists.email,
            subject: emailContent.subject,
            message: emailContent.html,
          });
          console.log('[DEBUG] Email sent successfully with OTP:', otp);
        } catch (error) {
          console.error('Failed to resend verification email:', error);
        }
      }

      // Return appropriate response based on verification status
      // For verified users: redirect to login (no verification needed)
      // For unverified users: redirect to OTP page
      if (userExists.isVerified) {
        // Verified user - tell frontend to go to login, not OTP
        // Use a flag that indicates account handling was done
        return res.status(201).json({
          message: 'If this email is already registered, you will receive an email with further instructions.',
          accountExists: true, // Frontend should redirect to login
          requireVerification: false
        });
      } else {
        // Unverified user - redirect to OTP page
        return res.status(201).json({
          message: 'If this email is not already registered, you will receive a verification email shortly.',
          requireVerification: true,
          email: email
        });
      }
    }

    // Check global settings
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    const requireVerification = settings.requireEmailVerification;

    // Generate Elite ID for new user (atomic sequence)
    // generateEliteId is deprecated wrapper, using generateUserIdentity
    const eliteIdData = await generateUserIdentity(false); // false = not admin

    // Common user data
    const userData = {
      username,
      email,
      password,
      firstName,
      lastName,
      phone,
      company,
      website,
      // Elite ID system
      eliteId: eliteIdData.eliteId,
      snapId: eliteIdData.snapId,
      idTier: eliteIdData.idTier,
      idNumber: eliteIdData.idNumber,
      // Legacy support (optional, can be removed if model allows sparse)
      // internalId: eliteIdData.eliteId 
    };

    let user;
    if (requireVerification) {
      const verificationToken = crypto.randomBytes(20).toString('hex');
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      user = await User.create({
        ...userData,
        isVerified: false,
        verificationToken,
        verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        otp,
        otpExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
      });

      // Generate beautiful verification email
      const emailContent = verificationEmail(user, verificationToken, otp);

      try {
        await sendEmail({
          email: user.email,
          subject: emailContent.subject,
          message: emailContent.html,
        });

        res.status(201).json({
          message: 'Registration successful! Please check your email to verify your account.',
          requireVerification: true,
          email: user.email // Return email for the OTP page
        });
      } catch (error) {
        await user.deleteOne();
        res.status(500);
        throw new Error('Email could not be sent');
      }

    } else {
      // ... existing no-verification logic ...
      user = await User.create({
        ...userData,
        isVerified: true,
      });

      const accessToken = generateAccessToken(user._id);
      const { refreshToken } = await createSession(user._id, req);

      // Send welcome email (non-blocking)
      try {
        const settings = await Settings.findOne();
        if (settings?.emailConfigured) {
          const emailContent = welcomeEmail(user);
          await sendEmail({
            email: user.email,
            subject: emailContent.subject,
            message: emailContent.html,
          });
        }
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError.message);
      }

      res.cookie('jwt', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: getCookieSameSite(),
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.status(201).json({
        _id: user._id,
        internalId: user.internalId,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        accessToken,
        requireVerification: false
      });
    }

  } catch (error) {
    next(error);
  }
};

// @desc    Verify Email via OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res, next) => {
  try {
    const result = verifyOtpSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400);
      throw new Error(result.error.errors[0].message);
    }

    const { email, otp } = result.data;

    const user = await User.findOne({ email });

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    if (user.isVerified) {
      return res.status(200).json({ message: 'Email already verified' });
    }

    // Check if user is banned
    if (!user.isActive) {
      res.status(403);
      throw new Error('Your account has been suspended. Please contact support.');
    }

    // Debug: Log OTP verification attempt
    console.log('[DEBUG verifyOTP] Email:', email);
    console.log('[DEBUG verifyOTP] Stored OTP:', user.otp);
    console.log('[DEBUG verifyOTP] OTP Expires:', user.otpExpires);
    console.log('[DEBUG verifyOTP] Current Time:', Date.now());
    console.log('[DEBUG verifyOTP] Is Expired:', !user.otp || user.otpExpires < Date.now());
    console.log('[DEBUG verifyOTP] Time Diff (ms):', user.otpExpires ? user.otpExpires - Date.now() : 'N/A');

    // Check OTP expiry first
    if (!user.otp || user.otpExpires < Date.now()) {
      console.log('[DEBUG verifyOTP] FAILED - OTP expired or missing');
      return res.status(400).json({
        message: 'Your verification code has expired. Please request a new one.',
        expired: true
      });
    }

    // Check OTP value using timing-safe comparison to prevent timing attacks
    const otpBuffer = Buffer.from(otp.padEnd(6, '0'));
    const storedOtpBuffer = Buffer.from((user.otp || '').padEnd(6, '0'));
    if (!crypto.timingSafeEqual(otpBuffer, storedOtpBuffer)) {
      res.status(400);
      throw new Error('Invalid verification code. Please check and try again.');
    }

    // Verify User
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    
    // Generate access token and create session
    const accessToken = generateAccessToken(user._id);
    const { refreshToken } = await createSession(user._id, req);

    res.cookie('jwt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: getCookieSameSite(),
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.status(200).json({
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      accessToken,
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Verify Email
// @route   GET /api/auth/verify-email/:token
// @access  Public
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    // First, try to find user with valid token
    let user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      // Token not found or expired - but check if any user with this token is already verified
      // This handles the race condition where token was just used
      const verifiedUser = await User.findOne({ 
        $or: [
          { verificationToken: token },
          { isVerified: true }
        ]
      });
      
      // If we can find a verified user, it means the verification already happened
      // (Note: We can't perfectly match the token to user after it's cleared,
      // so this is a best-effort check)
      if (verifiedUser && verifiedUser.isVerified && !verifiedUser.verificationToken) {
        // User is already verified - return success-like response
        return res.status(200).json({ 
          message: 'Your email has already been verified. You can now login.',
          alreadyVerified: true
        });
      }
      
      res.status(400);
      throw new Error('Invalid or expired verification token');
    }

    // Check if user is banned before allowing verification
    if (!user.isActive) {
      res.status(403);
      throw new Error('Your account has been suspended. Please contact support.');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    
    // Generate access token and create session
    const accessToken = generateAccessToken(user._id);
    const { refreshToken } = await createSession(user._id, req);

    // Set refresh token cookie
    res.cookie('jwt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: getCookieSameSite(),
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.status(200).json({ 
      message: 'Email verified successfully!',
      _id: user._id,
      internalId: user.internalId,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400);
      throw new Error(result.error.errors[0].message);
    }

    const { identifier, password } = result.data;

    // Find user by email OR username (case-insensitive)
    const identifierLower = identifier.toLowerCase();
    const user = await User.findOne({
      $or: [
        { email: identifierLower },
        { username: identifierLower }
      ]
    });

    // SECURITY: Always perform password comparison to prevent timing attacks
    // If user doesn't exist, compare against a dummy hash to maintain consistent timing
    const dummyHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.SJGPLvXqKBZ.xC';
    const isValidPassword = user 
      ? await user.matchPassword(password)
      : await bcrypt.compare(password, dummyHash);

    if (user && isValidPassword) {

      // Check if user is banned
      if (!user.isActive) {
        // Log failed login attempt (banned)
        await LoginHistory.create({
          userId: user._id,
          email: user.email,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          status: 'failed',
          failureReason: 'User is banned'
        });

        // Generate a temporary appeal token
        const appealToken = jwt.sign(
          { id: user._id, type: 'appeal' },
          process.env.JWT_ACCESS_SECRET,
          { expiresIn: '1h' }
        );

        return res.status(403).json({
          message: 'Your account has been suspended.',
          banned: true,
          bannedReason: user.bannedReason || 'Account suspended by administrator',
          bannedAt: user.bannedAt,
          bannedUntil: user.bannedUntil,
          userEmail: user.email,
          appealToken,
          support: {
            email: process.env.SUPPORT_EMAIL || 'support@example.com',
            message: 'If you believe this is a mistake, please contact our support team.'
          }
        });
      }

      // Check verification status if required
      let settings = await Settings.findOne();
      if (!settings) settings = await Settings.create({});

      if (settings.requireEmailVerification && !user.isVerified) {
        // Log failed login attempt (unverified)
        await LoginHistory.create({
          userId: user._id,
          email: user.email,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          status: 'failed',
          failureReason: 'Email not verified'
        });

        return res.status(403).json({
          message: 'Please verify your email address before logging in.',
          unverified: true,
          email: user.email
        });
      }

      const accessToken = generateAccessToken(user._id);
      
      // Create session with device info (replaces legacy refreshTokens array)
      const { refreshToken } = await createSession(user._id, req);

      // Update lastLoginAt
      await User.findByIdAndUpdate(user._id, { $set: { lastLoginAt: new Date() } });

      // Log successful login
      await LoginHistory.create({
        userId: user._id,
        email: user.email,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        status: 'success'
      });

      res.cookie('jwt', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: getCookieSameSite(),
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.json({
        _id: user._id,
        internalId: user.internalId,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        accessToken,
      });
    } else {
      // Log failed login attempt (invalid credentials)
      await LoginHistory.create({
        userId: user ? user._id : null,
        email: user ? user.email : identifier,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        status: 'failed',
        failureReason: 'Invalid credentials'
      });

      res.status(401);
      throw new Error('Invalid email or password');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Public
const logoutUser = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.jwt;
    if (!refreshToken) return res.sendStatus(204); // No content

    // Terminate the session in database
    const terminated = await terminateSession(refreshToken);
    
    if (!terminated) {
      console.log('[Logout] Session not found, clearing cookie anyway');
    }

    res.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: getCookieSameSite(),
    });
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh Access Token
// @route   GET /api/auth/refresh
// @access  Public (Cookie based)
const refreshAccessToken = async (req, res, next) => {
  try {
    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(401);
    const refreshToken = cookies.jwt;

    // Validate session using Session model
    const session = await validateSession(refreshToken);
    
    if (!session) {
      // Session not found or expired
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: getCookieSameSite(),
      });
      return res.sendStatus(403);
    }

    // Get the user
    const user = await User.findById(session.userId);
    if (!user) {
      // User was deleted
      await terminateSession(refreshToken);
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: getCookieSameSite(),
      });
      return res.sendStatus(403);
    }

    // Check if user is banned - immediately reject token refresh
    if (!user.isActive) {
      // Terminate all sessions for banned user
      await terminateAllUserSessions(user._id);
      
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: getCookieSameSite(),
      });
      return res.status(403).json({
        message: 'Your account has been suspended. Please contact support for assistance.',
        banned: true,
        userEmail: user.email
      });
    }

    // Verify the JWT (for additional security)
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      if (user._id.toString() !== decoded.id) {
        // Token user ID mismatch
        await terminateSession(refreshToken);
        res.clearCookie('jwt', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: getCookieSameSite(),
        });
        return res.sendStatus(403);
      }
    } catch (_) {
      // JWT verification failed (expired or invalid)
      await terminateSession(refreshToken);
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: getCookieSameSite(),
      });
      return res.sendStatus(403);
    }

    // Update session activity (last active time, IP if changed)
    await refreshSessionActivity(session, req);

    // Generate new access token (NOT a new refresh token - prevents race conditions)
    const accessToken = generateAccessToken(user._id);
    res.json({ accessToken });
    
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  const user = {
    _id: req.user._id,
    eliteId: req.user.eliteId,
    snapId: req.user.snapId,
    idTier: req.user.idTier,
    idNumber: req.user.idNumber,
    username: req.user.username,
    usernameChangedAt: req.user.usernameChangedAt,
    email: req.user.email,
    firstName: req.user.firstName,
    lastName: req.user.lastName,
    phone: req.user.phone,
    company: req.user.company,
    website: req.user.website,
    bio: req.user.bio,
    avatar: req.user.avatar,
    role: req.user.role,
    createdAt: req.user.createdAt,
    lastLoginAt: req.user.lastLoginAt,
    // Subscription & Usage data for frontend
    subscription: req.user.subscription || { tier: 'free', status: 'active' },
    linkUsage: req.user.linkUsage || { count: 0, resetAt: new Date() },
    clickUsage: req.user.clickUsage || { count: 0, resetAt: new Date() },
  };
  res.status(200).json(user);
};

// @desc    Update user profile
// @route   PUT /api/auth/me
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const result = updateProfileSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400);
      throw new Error(result.error.errors[0].message);
    }

    const { firstName, lastName, phone, company, website, bio, username } = result.data;

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Update Username if provided and different
    if (username && username !== user.username) {
        // 30-day cooldown check
        if (user.usernameChangedAt) {
            const daysSinceChange = (Date.now() - user.usernameChangedAt.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceChange < 30) {
                const nextChangeDate = new Date(user.usernameChangedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
                res.status(400);
                throw new Error(`Username change cooldown active. You can change your username again on ${nextChangeDate.toLocaleDateString()}`);
            }
        }

        // Check reserved words
        if (isReservedWord(username)) {
            res.status(400);
            throw new Error('This username is not available');
        }

        // Check format
        if (!/^[a-z0-9_-]+$/.test(username)) {
            res.status(400);
            throw new Error('Username must be alphanumeric');
        }

        // Check uniqueness
        const usernameExists = await User.findOne({ username: username.toLowerCase() });
        if (usernameExists) {
            res.status(400);
            throw new Error('Username is already taken');
        }

        // Log username change to history
        await UsernameHistory.create({
            userId: user._id,
            userInternalId: user.internalId,
            previousUsername: user.username,
            newUsername: username.toLowerCase(),
            changedBy: null  // self-initiated
        });

        // Update username and cooldown timestamp
        user.username = username.toLowerCase();
        user.usernameChangedAt = new Date();
    }

    // Update fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (company !== undefined) user.company = company;
    if (website !== undefined) user.website = website;
    if (bio !== undefined) user.bio = bio;

    await user.save();

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      company: user.company,
      website: user.website,
      bio: user.bio,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change user password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400);
      throw new Error('Current password and new password are required');
    }

    if (newPassword.length < 8) {
      res.status(400);
      throw new Error('New password must be at least 8 characters');
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      res.status(401);
      throw new Error('Current password is incorrect');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Security: Terminate all other sessions after password change
    // Keep the current session active
    const currentToken = req.cookies.jwt;
    if (currentToken) {
      const currentTokenHash = hashToken(currentToken);
      const result = await Session.deleteMany({ 
        userId: req.user._id, 
        tokenHash: { $ne: currentTokenHash } 
      });
      logger.info(`[Security] Password changed for user ${req.user._id}, terminated ${result.deletedCount} other sessions`);
    }

    res.json({ 
      message: 'Password changed successfully',
      sessionsTerminated: true 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resend OTP for email verification
// @route   POST /api/auth/resend-otp
// @access  Public
const resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Validate email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400);
      throw new Error('Please provide a valid email address');
    }

    const user = await User.findOne({ email });

    // Security: Don't reveal if user exists, is verified, or is banned
    if (!user || user.isVerified || !user.isActive) {
      return res.status(200).json({ 
        message: 'If an unverified account exists with this email, a new code has been sent.' 
      });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationToken = crypto.randomBytes(20).toString('hex');
    
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    // Send email
    const emailContent = verificationEmail(user, verificationToken, otp);
    await sendEmail({
      email: user.email,
      subject: emailContent.subject,
      message: emailContent.html,
    });

    res.status(200).json({ 
      message: 'A new verification code has been sent to your email.' 
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Forgot Password - Send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    // 1. Zod validation FIRST (no DB query yet)
    const result = forgotPasswordSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400);
      throw new Error(result.error.errors[0].message);
    }

    const { email } = result.data;

    // 2. Now query DB
    const user = await User.findOne({ email: email.toLowerCase() });

    // 3. Handle different user states
    if (!user) {
      // Generic response - don't reveal email doesn't exist
      return res.status(200).json({ 
        message: 'If this email exists, you will receive reset instructions shortly.' 
      });
    }

    // Banned user - return generic message
    if (!user.isActive) {
      return res.status(200).json({ 
        message: 'If this email exists, you will receive reset instructions shortly.' 
      });
    }

    // Unverified user - redirect to verification first
    if (!user.isVerified) {
      // Generate new verification OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationToken = crypto.randomBytes(20).toString('hex');
      
      user.otp = otp;
      user.otpExpires = Date.now() + 10 * 60 * 1000;
      user.verificationToken = verificationToken;
      user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
      await user.save();

      // Send verification email instead
      const emailContent = verificationEmail(user, verificationToken, otp);
      await sendEmail({
        email: user.email,
        subject: emailContent.subject,
        message: emailContent.html,
      });

      return res.status(200).json({ 
        message: 'Please verify your email first.',
        unverified: true,
        email: user.email
      });
    }

    // 4. Generate reset tokens
    const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    user.resetPasswordOtp = resetOtp;
    user.resetPasswordOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // 5. Send reset email
    const emailContent = passwordResetEmail(user, resetToken, resetOtp);
    await sendEmail({
      email: user.email,
      subject: emailContent.subject,
      message: emailContent.html,
    });

    res.status(200).json({ 
      message: 'If this email exists, you will receive reset instructions shortly.',
      success: true // Frontend uses this + the email from the input field
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    // 1. Zod validation FIRST (no DB query)
    const result = resetPasswordSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400);
      throw new Error(result.error.errors[0].message);
    }

    const { email, token, otp, newPassword } = result.data;
    let user;

    // 2. Find user by token OR by email+OTP
    if (token) {
      user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
        res.status(400);
        throw new Error('Invalid or expired reset link. Please request a new one.');
      }
    } else if (email && otp) {
      user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        res.status(400);
        throw new Error('Invalid email or OTP.');
      }

      // Check OTP expiry
      if (!user.resetPasswordOtp || user.resetPasswordOtpExpires < Date.now()) {
        res.status(400);
        throw new Error('Your reset code has expired. Please request a new one.');
      }

      // Timing-safe comparison for OTP
      const otpBuffer = Buffer.from(otp.padEnd(6, '0'));
      const storedOtpBuffer = Buffer.from((user.resetPasswordOtp || '').padEnd(6, '0'));
      if (!crypto.timingSafeEqual(otpBuffer, storedOtpBuffer)) {
        res.status(400);
        throw new Error('Invalid reset code. Please check and try again.');
      }
    } else {
      res.status(400);
      throw new Error('Provide either reset token or email + OTP.');
    }

    // 3. Update password
    user.password = newPassword; // Will be hashed by pre-save hook
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpires = undefined;
    
    // Optionally clear all refresh tokens to force re-login everywhere
    // user.refreshTokens = [];
    
    await user.save();

    res.status(200).json({ 
      message: 'Password reset successful. You can now log in with your new password.' 
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Check username availability
// @route   GET /api/auth/check-username/:username
// @access  Public (rate limited)
const checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.json({ available: false, reason: 'invalid' });
    }

    const usernameLower = username.toLowerCase().trim();
    
    // Validate length
    if (usernameLower.length < 3 || usernameLower.length > 30) {
      return res.json({ available: false, reason: 'invalid' });
    }

    // Validate format
    if (!/^[a-z0-9_-]+$/.test(usernameLower)) {
      return res.json({ available: false, reason: 'invalid' });
    }
    
    // Check reserved words
    if (isReservedWord(usernameLower)) {
      return res.json({ available: false, reason: 'reserved' });
    }
    
    // Check if exists in database
    const exists = await User.findOne({ username: usernameLower });
    
    res.json({ 
      available: !exists, 
      reason: exists ? 'taken' : null 
    });
  } catch (error) {
    console.error('Username check error:', error);
    res.status(500).json({ available: false, reason: 'error' });
  }
};

export { registerUser, loginUser, logoutUser, refreshAccessToken, getMe, updateProfile, changePassword, verifyEmail, verifyOTP, resendOTP, forgotPassword, resetPassword, checkUsernameAvailability };
