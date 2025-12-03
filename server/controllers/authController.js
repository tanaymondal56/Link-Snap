import User from '../models/User.js';
import Settings from '../models/Settings.js';
import LoginHistory from '../models/LoginHistory.js';
import { generateAccessToken, generateRefreshToken } from '../utils/generateToken.js';
import { registerSchema, loginSchema, updateProfileSchema } from '../validators/authValidator.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import sendEmail from '../utils/sendEmail.js';

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

    if (userExists) {
      res.status(400);
      throw new Error('User already exists');
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
      user = await User.create({
        ...userData,
        isVerified: false,
        verificationToken,
        verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      });

      const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
      const message = `
        <h1>Email Verification</h1>
        <p>Hi${firstName ? ` ${firstName}` : ''},</p>
        <p>Please click the link below to verify your account:</p>
        <a href="${verifyUrl}" clicktracking=off>${verifyUrl}</a>
      `;

      try {
        await sendEmail({
          email: user.email,
          subject: 'Link Snap - Verify your email',
          message,
        });

        res.status(201).json({
          message: 'Registration successful! Please check your email to verify your account.',
          requireVerification: true
        });
      } catch (error) {
        await user.deleteOne();
        res.status(500);
        throw new Error('Email could not be sent');
      }

    } else {
      // No verification needed
      user = await User.create({
        ...userData,
        isVerified: true,
      });

      const accessToken = generateAccessToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      user.refreshTokens.push(refreshToken);
      await user.save();

      res.cookie('jwt', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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

// @desc    Verify Email
// @route   GET /api/auth/verify-email/:token
// @access  Public
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      res.status(400);
      throw new Error('Invalid or expired token');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Email verified successfully! You can now login.' });
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

    if (user && (await user.matchPassword(password))) {

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
          userEmail: user.email,
          appealToken,
          support: {
            email: 'support@linksnap.com',
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

        res.status(401);
        throw new Error('Please verify your email address before logging in.');
      }

      const accessToken = generateAccessToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      if (user.refreshTokens.length >= 5) {
        user.refreshTokens = user.refreshTokens.slice(-4);
      }
      user.refreshTokens.push(refreshToken);
      user.lastLoginAt = new Date();
      await user.save();

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
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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
        sameSite: 'strict',
      });
      return res.sendStatus(204);
    }

    // Delete refreshToken in db
    user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
    await user.save();

    res.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
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

    const user = await User.findOne({ refreshTokens: refreshToken });
    if (!user) return res.sendStatus(403); // Forbidden

    // Check if user is banned - immediately reject token refresh
    if (!user.isActive) {
      // Clear the invalid refresh token cookie
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      });
      return res.status(403).json({
        message: 'Your account has been suspended. Please contact support for assistance.',
        banned: true,
        userEmail: user.email
      });
    }

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err || user._id.toString() !== decoded.id) {
        // If token is invalid but was found in DB, it might be a reuse attempt or expiry
        // For high security, invalidate all tokens to prevent account takeover
        user.refreshTokens = [];
        await user.save();
        return res.sendStatus(403);
      }

      // Token Rotation: Delete the used refresh token and issue a new one
      const newRefreshToken = generateRefreshToken(user._id);
      user.refreshTokens = user.refreshTokens.filter(rt => rt !== refreshToken);
      user.refreshTokens.push(newRefreshToken);
      await user.save();

      // Send new refresh token as cookie
      res.cookie('jwt', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      const accessToken = generateAccessToken(user._id);
      res.json({ accessToken });
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

    if (newPassword.length < 6) {
      res.status(400);
      throw new Error('New password must be at least 6 characters');
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

export { registerUser, loginUser, logoutUser, refreshAccessToken, getMe, updateProfile, changePassword, verifyEmail };
