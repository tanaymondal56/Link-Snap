import logger from '../utils/logger.js';

/**
 * Extracts normalized hostnames from various request headers
 */
const extractHostnames = (req) => {
  const hostnames = new Set();

  const addHost = (val) => {
    if (!val || typeof val !== 'string') return;
    for (const part of val.split(',')) {
      const clean = part.trim();
      if (!clean) continue;
      try {
        if (clean.startsWith('http://') || clean.startsWith('https://')) {
          hostnames.add(new URL(clean).hostname.toLowerCase());
        } else if (clean.startsWith('[') && clean.includes(']')) {
          hostnames.add(clean.substring(1, clean.indexOf(']')).toLowerCase());
        } else if (clean.includes(':') && clean.indexOf(':') !== clean.lastIndexOf(':')) {
          // Multiple colons: unbracketed IPv6 literal (e.g. ::1)
          hostnames.add(clean.toLowerCase());
        } else {
          hostnames.add(clean.split(':')[0].toLowerCase());
        }
      } catch {
        // Ignore malformed URL
      }
    }
  };

  const getHeader = (name) => {
    try {
      if (typeof req.get === 'function') {
        return req.get(name);
      }
      return req.headers?.[name];
    } catch {
      return undefined;
    }
  };

  addHost(getHeader('x-forwarded-host'));
  addHost(getHeader('host'));
  addHost(getHeader('origin'));
  addHost(getHeader('referer'));
  if (req.hostname) {
    addHost(req.hostname);
  }

  return Array.from(hostnames);
};

// Production domains that must NEVER allow tester/dev routes
const STRICT_PROD_HOSTS = new Set([
  'lksnp.qzz.io',
  'www.lksnp.qzz.io',
  'api.lksnp.qzz.io',
  'link-snap.pages.dev',
]);

/**
 * Checks if the request is executing within a local development or authorized beta domain.
 * Strictly forbids production domain requests.
 * 
 * @param {import('express').Request} req - Express request
 * @returns {boolean} True if environment is beta or local
 */
export const isBetaOrLocalEnvironment = (req) => {
  const hostnames = extractHostnames(req);

  const getHdr = (name) => {
    try {
      if (typeof req?.get === 'function') {
        return req.get(name);
      }
      return req?.headers?.[name];
    } catch {
      return undefined;
    }
  };

  const isBffProxy =
    (process.env.BFF_SECRET && getHdr('x-linksnap-bff-secret') === process.env.BFF_SECRET) ||
    getHdr('x-linksnap-bff') === 'true' ||
    Boolean(getHdr('cf-access-client-id'));
  let xForwardedHost = (getHdr('x-forwarded-host') || '').split(',')[0].trim().toLowerCase();
  if (xForwardedHost.startsWith('http://') || xForwardedHost.startsWith('https://')) {
    try {
      xForwardedHost = new URL(xForwardedHost).hostname.toLowerCase();
    } catch {
      // Ignore malformed URL
    }
  } else if (xForwardedHost.startsWith('[') && xForwardedHost.includes(']')) {
    xForwardedHost = xForwardedHost.substring(1, xForwardedHost.indexOf(']')).toLowerCase();
  } else if (xForwardedHost.includes(':')) {
    xForwardedHost = xForwardedHost.split(':')[0].toLowerCase();
  }

  const isBetaClient =
    xForwardedHost === 'beta.lksnp.qzz.io' ||
    (xForwardedHost.endsWith('.lksnp.qzz.io') && (
      xForwardedHost.startsWith('beta.') ||
      xForwardedHost.startsWith('api-beta.')
    )) ||
    (xForwardedHost.endsWith('.pages.dev') && xForwardedHost.includes('beta'));

  // 1. Strict production check: if ANY host/origin points directly to production, reject immediately
  for (const host of hostnames) {
    if (host === 'api.lksnp.qzz.io' && isBffProxy && isBetaClient) {
      continue;
    }
    if (STRICT_PROD_HOSTS.has(host)) {
      return false;
    }
    // Also catch bare apex/subdomain without beta prefix
    if (
      (host === 'lksnp.qzz.io' || host.endsWith('.lksnp.qzz.io')) &&
      !host.startsWith('beta.') &&
      !host.startsWith('api-beta.')
    ) {
      return false;
    }
    if (host.endsWith('link-snap.pages.dev') && !host.includes('beta')) {
      return false;
    }
  }

  // 2. Explicit BETA_HOSTS environment configuration
  const customBetaHosts = (process.env.BETA_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  for (const host of hostnames) {
    if (customBetaHosts.includes(host)) {
      return true;
    }
  }

  // 3. Known Beta domains
  const isBetaDomain = hostnames.some((host) => {
    return (
      host === 'beta.lksnp.qzz.io' ||
      host === 'api-beta.lksnp.qzz.io' ||
      (host.endsWith('.lksnp.qzz.io') && (
        host.startsWith('beta.') ||
        host.startsWith('api-beta.')
      )) ||
      (host.endsWith('.pages.dev') && host.includes('beta'))
    );
  });

  if (isBetaDomain) {
    return true;
  }

  // 4. Localhost / Loopback / Local network (for local testing)
  const isLocalHost = hostnames.some((host) => {
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '[::1]' ||
      Boolean(host.match(/^192\.168\.\d{1,3}\.\d{1,3}$/)) ||
      Boolean(host.match(/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) ||
      Boolean(host.match(/^172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}$/))
    );
  });

  if (isLocalHost) {
    return true;
  }

  // 5. Explicit Environment variable overrides (if no hostnames or during internal tests)
  if (process.env.ENVIRONMENT === 'beta' || process.env.IS_BETA === 'true') {
    return true;
  }

  if (process.env.NODE_ENV === 'development' && hostnames.length === 0) {
    return true;
  }

  return false;
};

/**
 * Express gate middleware that fails closed with HTTP 404 Not Found (Ghost Mode)
 * if the request does not originate from beta or local environment.
 */
export const requireBetaOrLocal = (req, res, next) => {
  if (!isBetaOrLocalEnvironment(req)) {
    logger.warn(`[DomainGate] Blocked non-beta/non-local request to: ${req.method} ${req.originalUrl || req.path}`);
    return res.status(404).json({ message: 'Not found' });
  }

  next();
};

export default {
  isBetaOrLocalEnvironment,
  requireBetaOrLocal,
};
