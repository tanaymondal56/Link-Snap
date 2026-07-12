// Load environment variables FIRST - must be before any other imports
import './config/env.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
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
// ═══════════════════════════════════════════════════════════════════════════════
// PROXY GATE SECURITY (Azure → AWS Migration)
// ═══════════════════════════════════════════════════════════════════════════════
// This middleware ensures ALL requests come through authorized Azure proxy
// Set PROXY_GATE_ENABLED=true in production, false for local development
import { strictProxyGate, validateProxyGateConfig } from './middleware/strictProxyGate.js';
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
import webhookRoutes from './routes/webhookRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import { flushAndStop } from './services/clickStatsService.js';
import { stopDeviceAuthIntervals } from './controllers/deviceAuthController.js';
import { flushAnalyticsAndStop } from './services/analyticsService.js';
import compression from 'compression';
import mongoose from 'mongoose';
import { connectRedis, checkRedisConnection, disconnectRedis, isRedisConfigured } from './config/redis.js';

const app = express();

// ═══════════════════════════════════════════════════════════════════════════════
// TRUST PROXY CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
// When PROXY_GATE_ENABLED=true (production):
//   - Trust ONLY the Azure Tailscale IP from TRUSTED_PROXY_IPS
//   - This ensures we ONLY accept requests from the authorized proxy
//
// When PROXY_GATE_ENABLED=false (local dev):
//   - Trust 1 proxy in the chain (generic, for local testing)
//   - Security is disabled, so strictProxyGate will bypass validation
const getTrustProxySetting = () => {
  const isProxyGateEnabled = process.env.PROXY_GATE_ENABLED === 'true';

  if (isProxyGateEnabled) {
    // Production: Trust only the specific Azure Tailscale IPs
    const trustedIPs = process.env.TRUSTED_PROXY_IPS
      ? process.env.TRUSTED_PROXY_IPS.split(',').map(ip => ip.trim())
      : ['127.0.0.1']; // Fallback to localhost only
    return trustedIPs;
  }

  // Local dev: Trust 1 proxy (generic)
  return 1;
};

app.set('trust proxy', getTrustProxySetting());

// Enable compression for all responses (Gzip/Brotli)
app.use(compression({
  level: 6, // Balance between speed and compression ratio
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRICT PROXY GATE - FIRST SECURITY LAYER
// ═══════════════════════════════════════════════════════════════════════════════
// This MUST be the first middleware after basic setup (morgan/compression)
// Validates: Secret Token → Tailscale IP → Extracts Real User IP
// Bypasses: /health endpoint for load balancer probes
// Toggle: PROXY_GATE_ENABLED=false for local development
app.use(strictProxyGate);


// Build dynamic connectSrc for CSP based on configured allowed origins
const dynamicConnectSrc = [
  "'self'",
  process.env.CLIENT_URL || "http://localhost:3000",
  // Allow all entries from ALLOWED_ORIGINS as well
  ...(() => {
    if (!process.env.ALLOWED_ORIGINS) return [];
    return process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
  })(),
];

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        ...(process.env.NODE_ENV === 'development' ? ["'unsafe-inline'"] : []),
      ],
      styleSrc: ["'self'", "'unsafe-inline'"], // Required for inline styles
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: dynamicConnectSrc,
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

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/$/, '');

const parseCsvOrigins = (value) => {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);
};

// Keep only canonical domains here. Add extras via ALLOWED_ORIGINS env var.
const productionDefaultOrigins = [
  'https://lksnp.qzz.io',
  'https://api.lksnp.qzz.io',    // API subdomain used in BFF / Cloudflare Tunnel architecture
  'https://link-snap.pages.dev',  // Cloudflare Pages default domain (project-specific URL)
];

// Built-in wildcard: allows any current or future subdomain of lksnp.qzz.io
// (e.g. api.lksnp.qzz.io, beta.lksnp.qzz.io) without any config changes.
const BUILTIN_WILDCARD_REGEX = /^https:\/\/([a-z0-9-]+\.)*lksnp\.qzz\.io$/i;

const allowedOrigins = Array.from(new Set([
  normalizeOrigin(process.env.CLIENT_URL),
  ...parseCsvOrigins(process.env.ALLOWED_ORIGINS),
  ...productionDefaultOrigins,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean)));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, or same-origin in production)
    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);

    // Exact-match allowlist (fastest path)
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // ── Wildcard: any *.lksnp.qzz.io subdomain ────────────────────────────
    // Covers any current or future subdomain automatically
    if (BUILTIN_WILDCARD_REGEX.test(normalizedOrigin)) {
      return callback(null, true);
    }

    // ── Dynamic host checker (via env var regex) ───────────────────────────
    // Allow additional custom domains via DYNAMIC_ALLOWED_DOMAINS_REGEX env var
    // Example: ^https:\/\/(.*?\.)?yourdomain\.com$
    if (process.env.DYNAMIC_ALLOWED_DOMAINS_REGEX) {
      try {
        const regex = new RegExp(process.env.DYNAMIC_ALLOWED_DOMAINS_REGEX, 'i');
        if (regex.test(normalizedOrigin)) {
          return callback(null, true);
        }
      } catch (e) {
        console.error(`[CORS] Invalid DYNAMIC_ALLOWED_DOMAINS_REGEX: ${e.message}`);
      }
    }

    // For development, allow localhost and LAN variants
    if (process.env.NODE_ENV === 'development' && (
      normalizedOrigin.includes('localhost') ||
      normalizedOrigin.includes('127.0.0.1') ||
      normalizedOrigin.match(/^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|100\.)/) // Local network IPs
    )) {
      return callback(null, true);
    }

    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
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
// ─── Cross-Origin Cookie Mode ──────────────────────────────────────────────
// When frontend is hosted on a DIFFERENT domain (CF Pages, Vercel, external CDN),
// cookies MUST use SameSite=None + Secure to be sent in cross-origin requests.
// When frontend is on the SAME domain, SameSite=Strict is safer.
// Set CROSS_ORIGIN_FRONTEND=true in configmap.yaml to enable cross-origin mode.
const isCrossOriginFrontend = process.env.CROSS_ORIGIN_FRONTEND === 'true';
const cookieSameSite = isCrossOriginFrontend ? 'none' : 'strict';
const cookieSecure  = isCrossOriginFrontend ? true : (process.env.NODE_ENV === 'production');

app.use(cookieSession({
  name: 'session',
  keys: [(() => {
    const secret = process.env.SESSION_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      console.error('[FATAL] SESSION_SECRET env var is not set in production. Refusing to start with an insecure session key.');
      process.exit(1);
    }
    return secret || 'dev-only-insecure-session-key';
  })()],
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  secure: cookieSecure,
  httpOnly: true,
  sameSite: cookieSameSite,
}));

// Configure CSRF with double-submit cookie pattern
app.use(lusca.csrf({
  cookie: {
    name: 'XSRF-TOKEN',
    options: {
      httpOnly: false, // Allow client to read for header inclusion
      secure: cookieSecure,
      sameSite: cookieSameSite,
    }
  },
  header: 'X-XSRF-TOKEN',
  blacklist: [
    { type: 'startsWith', path: '/api/webhooks' }, // Webhooks use signature verification
    { type: 'startsWith', path: '/api/url/' } // Public redirect and password verification endpoints
  ]
}));

// NoSQL injection protection
app.use(mongoSanitize);

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

// Deep health check - verifies database and Redis connectivity
app.get('/api/health/deep', async (req, res) => {
  const dbConnected = isConnected();

  // Real Redis ping — checkRedisConnection() returns false if not configured
  const redisConfigured = isRedisConfigured();
  const redisReachable = await checkRedisConnection();
  const redisStatus = !redisConfigured ? 'not_configured' : (redisReachable ? 'connected' : 'unreachable');

  // Service is healthy if DB is up. Redis degraded is non-fatal (falls back to in-memory).
  const allOk = dbConnected;
  const statusCode = allOk ? 200 : 503;

  res.status(statusCode).json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: dbConnected ? 'connected' : 'disconnected',
      redis: redisStatus,
    },
  });
});

// Rate Limiting
app.use('/api', apiLimiter);
// app.use('/api/auth', authLimiter); // Moved to specific routes in authRoutes.js

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
// Short URL redirect routes (This must be after all API routes)
app.use('/', redirectRoutes);


  // Development mode - catch-all for 404s
  app.get('/{*splat}', (req, res) => {
    // Return proper 404 response for invalid short URLs
    res.status(404).json({
      message: 'Short link not found',
      shortId: req.path.slice(1), // Remove leading slash
      suggestion: 'This link may have expired or been deleted'
    });
  });

  app.get('/', (req, res) => {
    res.send('Link Snap API is running...');
  });

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    // Initialise Upstash Redis (non-blocking — falls back gracefully if not configured)
    connectRedis();

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDATE PROXY GATE CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════
    // This validates the proxy security settings and will exit with error if
    // misconfigured in production. MUST be called after DB connects but before listen.
    validateProxyGateConfig();

    const server = app.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);

      // Cron jobs are now handled by independent K8s CronJobs.
    });

    // ─── Graceful Shutdown Handler ──────────────────────────────────────────────
    // Kubernetes sends SIGTERM when scaling down or rolling updates.
    // We must stop accepting new connections, finish in-flight requests,
    // flush analytics, and close DB before the 30-second SIGKILL deadline.
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      // 1. Stop accepting new HTTP connections
      server.close(async () => {
        try {
          logger.info('[Shutdown] HTTP server closed. Cleaning up...');

          // 2. Stop background timers
          stopDeviceAuthIntervals();

          // 3. Flush buffered click counts to DB (prevent data loss)
          logger.info('[Shutdown] Flushing click stats buffer...');
          await flushAndStop();

          // 3b. Flush buffered analytics to DB (prevent data loss)
          logger.info('[Shutdown] Flushing analytics buffer...');
          await flushAnalyticsAndStop();

          // 4. Release Redis HTTP client
          disconnectRedis();

          // 5. Close MongoDB connection cleanly
          await mongoose.connection.close(false);
          logger.info('[Shutdown] MongoDB connection closed.');

          process.exit(0);
        } catch (err) {
          logger.error(`[Shutdown] Error during cleanup: ${err.message}`);
          process.exit(1);
        }
      });

      // Hard kill if graceful shutdown takes too long (K8s will SIGKILL at 30s anyway)
      setTimeout(() => {
        logger.error('[Shutdown] Timed out after 15s. Forcing exit.');
        process.exit(1);
      }, 15000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();

// ─── Global Error Safety Net ────────────────────────────────────────────────
// Prevents CrashLoopBackOff from unhandled async failures
process.on('unhandledRejection', (reason) => {
  logger.error(`[UnhandledRejection] ${reason}`);
  // Do NOT exit — log and let monitoring catch it
});

process.on('uncaughtException', (err) => {
  logger.error(`[UncaughtException] ${err.message}`);
  // Uncaught exceptions leave the process in an unknown state
  // Let it crash naturally so K8s restarts it
  process.exit(1);
});
