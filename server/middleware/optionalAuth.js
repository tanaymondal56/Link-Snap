import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { redisGet, redisSet, getRedisClient } from '../config/redis.js';

/**
 * Optional authentication middleware
 * If a valid token is provided, attaches user to req.user
 * If no token or invalid token, continues without user (req.user = null)
 * Use this for routes that work with or without authentication
 * 
 * Supports both standard Users and MasterAdmins (aligns with authMiddleware.js).
 * Uses Redis user cache with MongoDB fallback.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    // Support both cookie-based and Authorization header tokens
    if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    } else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      req.user = null;
      return next();
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
      
      // MasterAdmin support — matches logic in authMiddleware.js
      if (decoded.type === 'master' || decoded.role === 'master_admin') {
        const { default: MasterAdmin } = await import('../models/MasterAdmin.js');
        const masterAdmin = await MasterAdmin.findById(decoded.id).select('-password');
        if (masterAdmin) {
          masterAdmin.subscription = { tier: 'pro', status: 'active', plan: 'pro_annual' };
          req.user = masterAdmin;
        } else {
          req.user = null;
        }
        return next();
      }
      
      // Standard user lookup with Redis cache
      const redis = getRedisClient();
      const cacheKey = `ls:user:${decoded.id}`;
      let userData = null;

      if (redis) {
          userData = await redisGet(cacheKey);
      }

      let user;
      if (userData) {
          user = User.hydrate(userData);
      } else {
          user = await User.findById(decoded.id).select('-password -refreshTokens');
          if (user && redis) {
              await redisSet(cacheKey, 300, user.toObject());
          }
      }
      
      if (user && user.isActive !== false) {
        req.user = user;
      } else {
        req.user = null;
      }
    } catch {
      // Invalid or expired token — continue as guest (expected in optional auth)
      req.user = null;
    }
    
    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    req.user = null;
    next();
  }
};

export default optionalAuth;
