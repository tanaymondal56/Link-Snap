import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { redisGet, redisSet, getRedisClient } from '../config/redis.js';

/**
 * Optional authentication middleware
 * If a valid token is provided, attaches user to req.user
 * If no token or invalid token, continues without user (req.user = null)
 * Use this for routes that work with or without authentication
 * 
 * Uses Redis user cache with MongoDB fallback.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      req.user = null;
      return next();
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      
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
      
      if (user && !user.banned && user.isActive !== false) {
        req.user = user;
      } else {
        req.user = null;
      }
    } catch {
      // Invalid token, continue as guest
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
