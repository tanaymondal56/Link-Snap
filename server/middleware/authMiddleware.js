import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import MasterAdmin from '../models/MasterAdmin.js';
import { redisGet, redisSet, getRedisClient } from '../config/redis.js';

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      if (decoded.type === 'master' || decoded.role === 'master_admin') {
          // --- MASTER ADMIN LOOKUP ---
          req.user = await MasterAdmin.findById(decoded.id).select('-password');
          
          if (!req.user) {
              res.status(401);
              throw new Error('Master Admin not found');
          }
          
          // Inject mock subscription for Master Admin to enable Pro features
          req.user.subscription = { tier: 'pro', status: 'active', plan: 'pro_annual' };
      } else {
          // --- STANDARD USER LOOKUP ---
          const redis = getRedisClient();
          const cacheKey = `ls:user:${decoded.id}`;
          let userData = null;

          if (redis) {
              userData = await redisGet(cacheKey);
          }

          if (userData) {
              req.user = User.hydrate(userData);
          } else {
              const dbUser = await User.findById(decoded.id).select('-password -refreshTokens');

              if (!dbUser) {
                res.status(401);
                throw new Error('User not found');
              }

              req.user = dbUser;

              if (redis) {
                  await redisSet(cacheKey, 300, dbUser.toObject());
              }
          }

          if (!req.user.isActive) {
            // Return ban response immediately without going through error handler
            return res.status(403).json({
              message: 'Your account has been suspended. Please contact support for assistance.',
              banned: true,
              bannedAt: req.user.bannedAt,
              bannedUntil: req.user.bannedUntil,
              bannedReason: req.user.bannedReason,
              userEmail: req.user.email
            });
          }
      }

      next();
    } catch (error) {
      // Don't log expected token expiration errors (frontend handles refresh)
      // Only log unexpected errors like malformed tokens or server issues
      if (error.name !== 'TokenExpiredError') {
        console.error('🔐 Auth Error:', error.message);
      }
      
      // Check if response already sent (for ban case)
      if (!res.headersSent) {
        res.status(401);
        const err = new Error('Not authorized, token failed');
        next(err);
      }
    }
  } else if (!token) {
    res.status(401);
    const err = new Error('Not authorized, no token');
    next(err);
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403); // Forbidden
    const err = new Error('Not authorized as an admin');
    next(err);
  }
};

// Alias for protect (used in admin routes)
const verifyToken = protect;

export { protect, admin, verifyToken };
