import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Optional authentication middleware
 * If a valid token is provided, attaches user to req.user
 * If no token or invalid token, continues without user (req.user = null)
 * Use this for routes that work with or without authentication
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue as guest
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
      const user = await User.findById(decoded.id).select('-password');
      
      if (user && !user.banned && user.isActive !== false) {
        req.user = user;
      } else {
        req.user = null;
      }
    } catch (tokenError) {
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
