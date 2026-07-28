import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import MasterAdmin from '../models/MasterAdmin.js';
import { redisGet, redisSet, getRedisClient } from '../config/redis.js';

const protect = async (req, res, next) => {
  let token;

  if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  } else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
      req.jwtDecoded = decoded;

      // DBSC & Session Cookie Integrity Check.
      // 1. If dbscEnforced is true (hardware key registered), require the DBSC session ID to match.
      // 2. Even if not yet enforced, if session cookies (__Host-session or dbsc_session) are present,
      // they MUST match the dbscSessionId embedded in the JWT access token to prevent session alteration.
      if (decoded.dbscSessionId) {
        const clientSessionId = req.cookies?.['__Host-session'] || req.cookies?.['dbsc_session'] || req.headers['sec-secure-session-id'] || req.headers['sec-session-id'];
        if (decoded.dbscEnforced === true && (!clientSessionId || clientSessionId !== decoded.dbscSessionId)) {
          res.status(401);
          throw new Error('DBSC Binding Failed: Session cookie mismatch or missing');
        } else if (clientSessionId && clientSessionId !== decoded.dbscSessionId) {
          res.status(401);
          throw new Error('DBSC Binding Failed: Session cookie mismatch or missing');
        }
      }

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
      // Propagate TokenExpiredError with a specific code so the Axios interceptor
      // can distinguish expired tokens (trigger refresh) from tampered tokens (force logout).
      if (error.name === 'TokenExpiredError') {
        if (!res.headersSent) {
          return res.status(401).json({ 
            message: 'Token expired', 
            code: 'TOKEN_EXPIRED' 
          });
        }
        return;
      }

      if (error.message !== 'DBSC Binding Failed: Session cookie mismatch or missing') {
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
  if (req.user && (req.user.role === 'admin' || req.user.role === 'master_admin')) {
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
