// Load environment variables FIRST - must be before any other imports
import './config/env.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import connectDB from './config/db.js';
import errorHandler from './middleware/errorHandler.js';
import mongoSanitize from './middleware/sanitizer.js';
import logger from './utils/logger.js';
import { apiLimiter, authLimiter } from './middleware/rateLimiter.js';

import authRoutes from './routes/authRoutes.js';
import urlRoutes from './routes/urlRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import appealRoutes from './routes/appealRoutes.js';
import redirectRoutes from './routes/redirectRoutes.js';
import { startBanScheduler } from './services/banScheduler.js';

const app = express();

// Trust proxy (required for correct IP detection behind Nginx/Load Balancers)
app.set('trust proxy', 1);

// Middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Required for React in dev
      styleSrc: ["'self'", "'unsafe-inline'"], // Required for inline styles
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.CLIENT_URL || "http://localhost:3000"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: 'deny',
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
}));

const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // Add any tunnel URLs here if needed
];

// In production, also allow the same origin (when client is served from server)
if (process.env.NODE_ENV === 'production') {
  allowedOrigins.push(process.env.CLIENT_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin in production)
    if (!origin) return callback(null, true);

    // In production, allow same-origin requests
    if (process.env.NODE_ENV === 'production') {
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) === -1) {
      // For development, allow localhost variants
      if (process.env.NODE_ENV === 'development' && (
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.match(/^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|100\.)/) // Local network IPs
      )) {
        return callback(null, true);
      }
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// NoSQL injection protection
app.use(mongoSanitize);

// Rate Limiting
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

// Routes (API routes first)
app.use('/api/auth', authRoutes);
app.use('/api/url', urlRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/appeals', appealRoutes);

// Serve static assets in production (BEFORE redirect routes)
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // Serve static files from client build with proper cache headers
  app.use(express.static(path.join(__dirname, '../client/dist'), {
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // For HTML files, don't cache to ensure fresh content
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      // For JS/CSS with hash in filename, cache forever (immutable)
      else if (filePath.match(/\.[a-f0-9]{8}\.(js|css)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      // For other assets (images, fonts, etc), short cache with revalidation
      else {
        res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 minutes
      }
    }
  }));
}

// Short URL redirect routes (after static files, so JS/CSS/images are served directly)
app.use('/', redirectRoutes);

// SPA catch-all route (after redirect routes)
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // Catch-all route for SPA - Express 5 uses {*param} syntax
  // This handles all routes not matched by API or redirect routes
  app.get('/{*splat}', (req, res) => {
    console.log(`[SPA Catch-all] Serving index.html for: ${req.path}`);
    // Set no-cache headers for SPA routes to ensure fresh content after builds
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.resolve(__dirname, '../client/dist/index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Link Snap API is running...');
  });
}

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Start server only after database connection is established
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);

      // Start the temporary ban scheduler
      startBanScheduler();
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
