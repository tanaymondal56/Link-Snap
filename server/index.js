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
import { apiLimiter } from './middleware/rateLimiter.js';
import lusca from 'lusca';
import cookieSession from 'cookie-session';

import authRoutes from './routes/authRoutes.js';
import urlRoutes from './routes/urlRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
// Conditional Admin Import
// Ghost Mode: Admin routes are ONLY loaded if explicitly enabled
let adminRoutes = null;
if (process.env.ADMIN_ENABLED === 'true') {
   adminRoutes = (await import('./routes/adminRoutes.js')).default;
}
import appealRoutes from './routes/appealRoutes.js';
import changelogRoutes from './routes/changelogRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import redirectRoutes from './routes/redirectRoutes.js';
import bioRoutes from './routes/bioRoutes.js';
import deviceAuthRoutes from './routes/deviceAuthRoutes.js';
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
      scriptSrc: ["'self'", ...(process.env.NODE_ENV === 'development' ? ["'unsafe-inline'"] : [])], // 'unsafe-inline' only in dev
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

import webhookRoutes from './routes/webhookRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';

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

// Use JSON parser with raw body capture for webhooks
app.use(express.json({
  verify: (req, res, buf) => {
    // Store raw body for webhook signature verification
    if (req.originalUrl.startsWith('/api/webhooks')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ... imports

// CSRF Protection (using lusca as recommended by CodeQL)
// Lusca requires a session to store the CSRF secret.
// We use cookie-session to provide a client-side session.
app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'default-secret-key'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
}));

// Configure CSRF with double-submit cookie pattern
app.use(lusca.csrf({
  cookie: {
    name: 'XSRF-TOKEN',
    options: {
      httpOnly: false, // Allow client to read for header inclusion
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    }
  },
  header: 'X-XSRF-TOKEN',
  blacklist: ['/api/webhooks'] // Exclude webhooks if needed, though they usually use signatures
}));

// NoSQL injection protection
app.use(mongoSanitize);

// Rate Limiting
app.use('/api', apiLimiter);
// app.use('/api/auth', authLimiter); // Moved to specific routes in authRoutes.js

// Health Check Endpoints
import { isConnected } from './config/db.js';

// Basic health check - just confirms server is running
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Deep health check - verifies database connectivity
app.get('/api/health/deep', async (req, res) => {
  const dbConnected = isConnected();
  const status = dbConnected ? 'ok' : 'degraded';
  const statusCode = dbConnected ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: dbConnected ? 'connected' : 'disconnected',
    },
  });
});

// Routes (API routes first)
app.use('/api/auth', authRoutes);
app.use('/api/url', urlRoutes);
app.use('/api/analytics', analyticsRoutes);

if (adminRoutes) {
  app.use('/api/admin', adminRoutes);
}

// Hidden device auth routes (stealth biometric auth)
// Using obscure path /.d/ to hide from discovery
app.use('/api/.d', deviceAuthRoutes);

app.use('/api/appeals', appealRoutes);
app.use('/api/changelog', changelogRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/bio', bioRoutes);
// Serve static assets in production (BEFORE redirect routes)
if (process.env.NODE_ENV === 'development') {
  const devRoutes = (await import('./routes/devRoutes.js')).default;
  app.use('/api/dev', devRoutes);
  logger.info('Dev routes enabled under /api/dev');
}
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // Serve static files from client build with proper cache headers
  app.use(express.static(path.join(__dirname, '../client/dist'), {
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // For HTML files, don't cache to ensure fresh content
      // For HTML files and Service Worker, don't cache to ensure fresh content
      if (filePath.endsWith('.html') || filePath.includes('sw.js') || filePath.includes('workbox-')) {
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
