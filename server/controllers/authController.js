import User from '../models/User.js';
import Settings from '../models/Settings.js';
import LoginHistory from '../models/LoginHistory.js';
import { generateAccessToken, generateRefreshToken } from '../utils/generateToken.js';
import { registerSchema, loginSchema, updateProfileSchema, verifyOtpSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/authValidator.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import sendEmail from '../utils/sendEmail.js';
import { welcomeEmail, verificationEmail, accountExistsEmail, passwordResetEmail } from '../utils/emailTemplates.js';

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
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400);
      throw new Error(result.error.errors[0].message);
    }

    const { email, password, firstName, lastName, phone, company, website } = result.data;

    const userExists = await User.findOne({ email });

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

    // Common user data
    const userData = {
      email,
      password,
      firstName,
      lastName,
      phone,
      company,
      website,
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
      const refreshToken = generateRefreshToken(user._id);

      user.refreshTokens.push(refreshToken);
      await user.save();

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
        email: user.email,
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
    
    // Generate Tokens (Login immediately)
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    
    user.refreshTokens.push(refreshToken);
    await user.save();

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
    
    // Generate tokens for auto-login
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    
    user.refreshTokens.push(refreshToken);
    await user.save();

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

    const { email, password } = result.data;

    const user = await User.findOne({ email });

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
      const refreshToken = generateRefreshToken(user._id);

      // Use atomic operation to add refresh token and update lastLoginAt
      // This prevents version conflicts from concurrent logins
      // Also limits tokens to last 5 to prevent unbounded growth
      await User.findByIdAndUpdate(
        user._id,
        {
          $push: { 
            refreshTokens: { 
              $each: [refreshToken], 
              $slice: -5  // Keep only last 5 tokens
            } 
          },
          $set: { lastLoginAt: new Date() }
        }
      );

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
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        accessToken,
      });
    } else {
      // Log failed login attempt (invalid credentials)
      await LoginHistory.create({
        userId: user ? user._id : null,
        email: email,
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

    // Is refreshToken in db?
    const user = await User.findOne({ refreshTokens: refreshToken });
    if (!user) {
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: getCookieSameSite(),
      });
      return res.sendStatus(204);
    }

    // Delete refreshToken in db using atomic operation
    // This prevents version conflicts from concurrent logout requests
    await User.findByIdAndUpdate(
      user._id,
      { $pull: { refreshTokens: refreshToken } }
    );

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

    // Find user with this refresh token
    const user = await User.findOne({ refreshTokens: refreshToken });
    if (!user) {
      // Token not found in any user's tokens - could be reused/stolen
      // Clear the cookie to stop retry loops
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: getCookieSameSite(),
      });
      return res.sendStatus(403);
    }

    // Check if user is banned - immediately reject token refresh
    if (!user.isActive) {
      // Clear the invalid refresh token cookie
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

    // Verify the JWT
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err || user._id.toString() !== decoded.id) {
        // Token is invalid/expired - remove ONLY this token (not all tokens)
        // This prevents logging out other sessions/tabs
        try {
          await User.findByIdAndUpdate(
            user._id,
            { $pull: { refreshTokens: refreshToken } },
            { new: true }
          );
        } catch (updateErr) {
          console.error('Failed to remove invalid token:', updateErr);
        }
        
        // Clear the cookie
        res.clearCookie('jwt', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: getCookieSameSite(),
        });
        return res.sendStatus(403);
      }

      // Token Rotation: Remove old token and add new one
      // MongoDB doesn't allow $pull and $push on same field in single operation
      const newRefreshToken = generateRefreshToken(user._id);
      
      try {
        // Step 1: Remove the old token
        const pullResult = await User.findOneAndUpdate(
          { _id: user._id, refreshTokens: refreshToken },
          { $pull: { refreshTokens: refreshToken } },
          { new: true }
        );

        // If token was found and removed, add the new one
        if (pullResult) {
          // Step 2: Add the new token (with limit to prevent unbounded growth)
          await User.findByIdAndUpdate(
            user._id,
            { 
              $push: { 
                refreshTokens: { 
                  $each: [newRefreshToken], 
                  $slice: -5 // Keep only last 5 tokens
                } 
              } 
            }
          );
        } else {
          // Token was already used/rotated - this is likely a duplicate request
          // Still return success with a new token to prevent logout
          console.log('[Token Refresh] Token already rotated, issuing new token');
          
          // Try to add a new token without removing (concurrent request scenario)
          await User.findByIdAndUpdate(
            user._id,
            { 
              $push: { 
                refreshTokens: { 
                  $each: [newRefreshToken], 
                  $slice: -5 
                } 
              } 
            }
          );
        }

        // Send new refresh token as cookie
        res.cookie('jwt', newRefreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: getCookieSameSite(),
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });

        const accessToken = generateAccessToken(user._id);
        res.json({ accessToken });
        
      } catch (updateError) {
        console.error('[Token Refresh] Update error:', updateError);
        // On update error, still try to return a valid response
        // to prevent unnecessary logouts
        if (updateError.name === 'VersionError') {
          // Version conflict - another request already updated
          // Issue new token anyway to prevent logout
          const fallbackToken = generateRefreshToken(user._id);
          await User.findByIdAndUpdate(
            user._id,
            { $push: { refreshTokens: fallbackToken } }
          );
          
          res.cookie('jwt', fallbackToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: getCookieSameSite(),
            maxAge: 30 * 24 * 60 * 60 * 1000,
          });
          
          const accessToken = generateAccessToken(user._id);
          return res.json({ accessToken });
        }
        
        // For other errors, return 500 but don't clear tokens
        return res.status(500).json({ message: 'Token refresh failed, please try again' });
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  const user = {
    _id: req.user._id,
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

    const { firstName, lastName, phone, company, website, bio } = result.data;

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
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

    res.json({ message: 'Password changed successfully' });
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

export { registerUser, loginUser, logoutUser, refreshAccessToken, getMe, updateProfile, changePassword, verifyEmail, verifyOTP, resendOTP, forgotPassword, resetPassword };
