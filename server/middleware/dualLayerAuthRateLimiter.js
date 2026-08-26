import { getRedisClient, isRedisConfigured, getRedisDriver } from '../config/redis.js';
import { getUserIP } from './strictProxyGate.js';
import logger from '../utils/logger.js';

// IPs that bypass rate limiting
const envAllowedIPs = process.env.RATE_LIMIT_WHITELIST_IPS
  ? process.env.RATE_LIMIT_WHITELIST_IPS.split(',').map((ip) => ip.trim()).filter(Boolean)
  : [];

const WHITELIST_SET = new Set([
  '127.0.0.1',
  '::1',
  ...envAllowedIPs.map((ip) => (ip.startsWith('::ffff:') ? ip.slice(7) : ip)),
]);

const isWhitelisted = (ip) => {
  if (!ip) return false;
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  return normalized.startsWith('127.') || normalized === '::1' || WHITELIST_SET.has(normalized);
};

// In-Memory fallback store when Redis is not available
class InMemoryStore {
  constructor() {
    this.accountLocks = new Map(); // identifier -> { lockedUntil, reason }
    this.accountAttempts = new Map(); // identifier -> { count, expiresAt }
    this.accountIPs = new Map(); // identifier -> { ips: Set, expiresAt }
    this.ipAccounts = new Map(); // ip -> { accounts: Set, expiresAt }
    this.ipBlocks = new Map(); // ip -> { blockedUntil, reason }

    // Periodic cleanup of expired entries every 2 minutes
    setInterval(() => this.cleanupExpired(), 2 * 60 * 1000).unref();
  }

  cleanupExpired() {
    const now = Date.now();
    for (const [k, v] of this.accountLocks.entries()) {
      if (v.lockedUntil <= now) this.accountLocks.delete(k);
    }
    for (const [k, v] of this.accountAttempts.entries()) {
      if (v.expiresAt <= now) this.accountAttempts.delete(k);
    }
    for (const [k, v] of this.accountIPs.entries()) {
      if (v.expiresAt <= now) this.accountIPs.delete(k);
    }
    for (const [k, v] of this.ipAccounts.entries()) {
      if (v.expiresAt <= now) this.ipAccounts.delete(k);
    }
    for (const [k, v] of this.ipBlocks.entries()) {
      if (v.blockedUntil <= now) this.ipBlocks.delete(k);
    }
  }
}

const memoryStore = new InMemoryStore();

// Configuration Constants
const ACCOUNT_FAILED_ATTEMPT_LIMIT = 5; // Max 5 failed attempts per account
const ACCOUNT_ATTEMPT_WINDOW_SEC = 15 * 60; // 15 minutes
const ACCOUNT_LOCKOUT_SEC = 15 * 60; // 15 minutes lockout

const MULTI_IP_ATTACK_IP_THRESHOLD = 3; // Max 3 distinct IPs hitting 1 account in 15 mins
const CREDENTIAL_STUFFING_ACCOUNT_THRESHOLD = 5; // Max 5 distinct accounts hit by 1 IP in 15 mins
const IP_BLOCK_SEC = 60 * 60; // 1 hour block for malicious bot IPs

const INCR_EXPIRE_LUA = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], tonumber(ARGV[1]))
end
return count
`;

/**
 * Execute the atomic INCR+EXPIRE Lua script with the correct
 * signature for the active Redis driver.
 * - ioredis (TCP):    eval(script, numKeys, ...keysAndArgs)
 * - Upstash (HTTP):   eval(script, keys[], args[])
 */
const luaIncrExpire = async (redis, key, windowSec) => {
  if (getRedisDriver() === 'tcp') {
    return redis.eval(INCR_EXPIRE_LUA, 1, key, String(windowSec));
  }
  // Upstash uses array-based signature
  return redis.eval(INCR_EXPIRE_LUA, [key], [String(windowSec)]);
};

/**
 * Normalizes an account identifier (email or username)
 */
const normalizeIdentifier = (identifier) => {
  if (!identifier || typeof identifier !== 'string') return '';
  return identifier.trim().toLowerCase();
};

/**
 * Checks if an account is locked across ALL IPs
 */
export const isAccountLocked = async (identifier) => {
  const normId = normalizeIdentifier(identifier);
  if (!normId) return null;

  const redis = getRedisClient();
  const lockKey = `ls:acct:locked:${normId}`;

  if (redis && isRedisConfigured()) {
    try {
      const raw = await redis.get(lockKey);
      if (raw) {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const ttl = await redis.ttl(lockKey);
        return { ...data, remainingSec: ttl > 0 ? ttl : 900 };
      }
      return null;
    } catch (err) {
      logger.warn(`[DualRateLimit] Redis account lock check failed: ${err.message}`);
    }
  }

  // Memory fallback
  const memLock = memoryStore.accountLocks.get(normId);
  if (memLock && memLock.lockedUntil > Date.now()) {
    const remainingSec = Math.ceil((memLock.lockedUntil - Date.now()) / 1000);
    return { ...memLock, remainingSec };
  }
  return null;
};

/**
 * Checks if an IP address is blocked for credential stuffing / bot attacks
 */
export const isIPBlocked = async (ip) => {
  if (!ip || isWhitelisted(ip)) return null;

  const redis = getRedisClient();
  const blockKey = `ls:ip:blocked:${ip}`;

  if (redis && isRedisConfigured()) {
    try {
      const raw = await redis.get(blockKey);
      if (raw) {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const ttl = await redis.ttl(blockKey);
        return { ...data, remainingSec: ttl > 0 ? ttl : 3600 };
      }
      return null;
    } catch (err) {
      logger.warn(`[DualRateLimit] Redis IP block check failed: ${err.message}`);
    }
  }

  // Memory fallback
  const memBlock = memoryStore.ipBlocks.get(ip);
  if (memBlock && memBlock.blockedUntil > Date.now()) {
    const remainingSec = Math.ceil((memBlock.blockedUntil - Date.now()) / 1000);
    return { ...memBlock, remainingSec };
  }
  return null;
};

/**
 * Lock an account across ALL IPs
 */
const lockAccount = async (identifier, reason, lockSec = ACCOUNT_LOCKOUT_SEC) => {
  const normId = normalizeIdentifier(identifier);
  if (!normId) return;

  const lockData = {
    locked: true,
    reason,
    lockedAt: Date.now(),
    lockedUntil: Date.now() + lockSec * 1000,
  };

  const redis = getRedisClient();
  const lockKey = `ls:acct:locked:${normId}`;

  if (redis && isRedisConfigured()) {
    try {
      await redis.setex(lockKey, lockSec, JSON.stringify(lockData));
    } catch (err) {
      logger.warn(`[DualRateLimit] Redis set lock failed: ${err.message}`);
    }
  }

  // Memory fallback
  memoryStore.accountLocks.set(normId, lockData);
  logger.warn(`[Security Shield] ACCOUNT LOCKED (${normId}) across ALL IPs: ${reason}`);
};

/**
 * Block a malicious IP address globally
 */
const blockIP = async (ip, reason, blockSec = IP_BLOCK_SEC) => {
  if (!ip || isWhitelisted(ip)) return;

  const blockData = {
    blocked: true,
    reason,
    blockedAt: Date.now(),
    blockedUntil: Date.now() + blockSec * 1000,
  };

  const redis = getRedisClient();
  const blockKey = `ls:ip:blocked:${ip}`;

  if (redis && isRedisConfigured()) {
    try {
      await redis.setex(blockKey, blockSec, JSON.stringify(blockData));
    } catch (err) {
      logger.warn(`[DualRateLimit] Redis set IP block failed: ${err.message}`);
    }
  }

  // Memory fallback
  memoryStore.ipBlocks.set(ip, blockData);
  logger.warn(`[Security Shield] IP BLOCKED (${ip}) globally: ${reason}`);
};

/**
 * Record a failed authentication / verification attempt.
 * Updates:
 * 1. Failed attempts counter per account (across ALL IPs).
 * 2. Distinct IPs set hitting this account.
 * 3. Distinct accounts set hit by this IP.
 * Triggers account lock or IP block if security thresholds are exceeded.
 */
export const recordFailedAuthAttempt = async (identifier, req) => {
  const normId = normalizeIdentifier(identifier);
  const ip = getUserIP(req);
  const now = Date.now();

  if (!normId) return;

  const redis = getRedisClient();
  const attemptsKey = `ls:acct:attempts:${normId}`;
  const acctIpsKey = `ls:acct:ips:${normId}`;
  const ipAcctsKey = `ls:ip:accts:${ip}`;

  let attemptsCount = 1;
  let distinctIPs = 1;
  let distinctAccounts = 1;

  if (redis && isRedisConfigured()) {
    try {
      // 1. Increment failed attempts for account (atomic INCR+EXPIRE via Lua)
      attemptsCount = await luaIncrExpire(redis, attemptsKey, ACCOUNT_ATTEMPT_WINDOW_SEC);

      // 2. Track distinct IPs hitting this account & distinct accounts hit by this IP in a single pipeline
      const pipe = redis.pipeline();
      pipe.sadd(acctIpsKey, ip);
      pipe.expire(acctIpsKey, ACCOUNT_ATTEMPT_WINDOW_SEC);
      pipe.scard(acctIpsKey);

      const trackIpAccounts = !isWhitelisted(ip);
      if (trackIpAccounts) {
        pipe.sadd(ipAcctsKey, normId);
        pipe.expire(ipAcctsKey, ACCOUNT_ATTEMPT_WINDOW_SEC);
        pipe.scard(ipAcctsKey);
      }

      const results = await pipe.exec();
      const isTcp = getRedisDriver() === 'tcp';
      distinctIPs = isTcp ? results[2][1] : results[2];
      if (trackIpAccounts) {
        distinctAccounts = isTcp ? results[5][1] : results[5];
      }
    } catch (err) {
      logger.warn(`[DualRateLimit] Failed attempt recording error: ${err.message}`);
    }
  } else {
    // Memory store fallback
    const memAtt = memoryStore.accountAttempts.get(normId) || { count: 0, expiresAt: now + ACCOUNT_ATTEMPT_WINDOW_SEC * 1000 };
    memAtt.count += 1;
    memAtt.expiresAt = Math.max(memAtt.expiresAt, now + ACCOUNT_ATTEMPT_WINDOW_SEC * 1000);
    memoryStore.accountAttempts.set(normId, memAtt);
    attemptsCount = memAtt.count;

    const memIps = memoryStore.accountIPs.get(normId) || { ips: new Set(), expiresAt: now + ACCOUNT_ATTEMPT_WINDOW_SEC * 1000 };
    memIps.ips.add(ip);
    memIps.expiresAt = Math.max(memIps.expiresAt, now + ACCOUNT_ATTEMPT_WINDOW_SEC * 1000);
    memoryStore.accountIPs.set(normId, memIps);
    distinctIPs = memIps.ips.size;

    if (!isWhitelisted(ip)) {
      const memAccts = memoryStore.ipAccounts.get(ip) || { accounts: new Set(), expiresAt: now + ACCOUNT_ATTEMPT_WINDOW_SEC * 1000 };
      memAccts.accounts.add(normId);
      memAccts.expiresAt = Math.max(memAccts.expiresAt, now + ACCOUNT_ATTEMPT_WINDOW_SEC * 1000);
      memoryStore.ipAccounts.set(ip, memAccts);
      distinctAccounts = memAccts.accounts.size;
    }
  }

  // --- EVALUATE SECURITY THRESHOLDS ---

  // Threshold 1: Multi-IP Distributed Attack on single account
  if (distinctIPs >= MULTI_IP_ATTACK_IP_THRESHOLD) {
    // DO NOT lock the account (which creates a DoS vector against the victim)
    // Instead, block the attacking IP to break the botnet
    await blockIP(
      ip,
      `Participating in distributed brute-force attack against account`
    );
    return;
  }

  // Threshold 2: Account-wise Failed Attempt Threshold across ANY IP
  if (attemptsCount >= ACCOUNT_FAILED_ATTEMPT_LIMIT) {
    await lockAccount(
      normId,
      `Exceeded max failed login attempts (${attemptsCount}/${ACCOUNT_FAILED_ATTEMPT_LIMIT}) across devices/IPs`
    );
    return;
  }

  // Threshold 3: Single IP Credential Stuffing / Account Enumeration
  if (distinctAccounts >= CREDENTIAL_STUFFING_ACCOUNT_THRESHOLD && !isWhitelisted(ip)) {
    await blockIP(
      ip,
      `Credential stuffing attack detected (targeting ${distinctAccounts} distinct accounts)`
    );
  }
};

/**
 * Record a successful authentication. Clears account failed counter and IP set.
 */
export const recordSuccessfulAuthAttempt = async (identifier) => {
  const normId = normalizeIdentifier(identifier);
  if (!normId) return;

  const redis = getRedisClient();
  const attemptsKey = `ls:acct:attempts:${normId}`;
  const acctIpsKey = `ls:acct:ips:${normId}`;
  const lockKey = `ls:acct:locked:${normId}`;

  if (redis && isRedisConfigured()) {
    try {
      await redis.del(attemptsKey, acctIpsKey, lockKey);
    } catch (err) {
      logger.warn(`[DualRateLimit] Redis clear failed: ${err.message}`);
    }
  }

  // Memory fallback
  memoryStore.accountAttempts.delete(normId);
  memoryStore.accountIPs.delete(normId);
  memoryStore.accountLocks.delete(normId);
};

/**
 * Middleware: Dual-Layer Rate Limiter for Login (/api/auth/login)
 */
export const dualLayerLoginLimiter = async (req, res, next) => {
  const ip = getUserIP(req);

  // 1. Check if IP is globally blocked for bot/credential stuffing attacks
  const ipBlock = await isIPBlocked(ip);
  if (ipBlock) {
    const mins = Math.ceil(ipBlock.remainingSec / 60);
    return res.status(429).json({
      type: 'ip_blocked',
      message: `Access from this IP address is temporarily blocked due to automated attack patterns. Please try again in ${mins} minute${mins > 1 ? 's' : ''}.`,
      retryAfter: ipBlock.remainingSec,
    });
  }

  // 2. Extract account identifier (email or username)
  const identifier = normalizeIdentifier(req.body?.identifier || req.body?.email || '');

  if (identifier) {
    // Check if account is locked across ALL IPs
    const lockStatus = await isAccountLocked(identifier);
    if (lockStatus) {
      const mins = Math.ceil(lockStatus.remainingSec / 60);
      return res.status(429).json({
        type: 'account_locked',
        message: `This account has been temporarily locked due to multiple failed login attempts across devices/IPs. Please try again in ${mins} minute${mins > 1 ? 's' : ''}.`,
        retryAfter: lockStatus.remainingSec,
        locked: true,
      });
    }
  }

  next();
};

/**
 * Middleware: Dual-Layer Rate Limiter for Authentication & Account Actions
 * (/register, /change-password, /verify-otp, /resend-otp, /forgot-password, /reset-password)
 */
export const dualLayerAuthActionLimiter = async (req, res, next) => {
  const ip = getUserIP(req);

  // 1. Check IP block
  const ipBlock = await isIPBlocked(ip);
  if (ipBlock) {
    const mins = Math.ceil(ipBlock.remainingSec / 60);
    return res.status(429).json({
      type: 'ip_blocked',
      message: `Access temporarily blocked due to suspicious activity. Please try again in ${mins} minute${mins > 1 ? 's' : ''}.`,
      retryAfter: ipBlock.remainingSec,
    });
  }

  // 2. Check Account lock
  const identifier = normalizeIdentifier(
    req.user?.email || 
    req.user?.username || 
    req.body?.email || 
    req.body?.identifier || 
    req.params?.username || 
    ''
  );
  if (identifier) {
    const lockStatus = await isAccountLocked(identifier);
    if (lockStatus) {
      const mins = Math.ceil(lockStatus.remainingSec / 60);
      return res.status(429).json({
        type: 'account_locked',
        message: `Verification temporarily locked for this account due to multiple failed attempts across devices. Please try again in ${mins} minute${mins > 1 ? 's' : ''}.`,
        retryAfter: lockStatus.remainingSec,
        locked: true,
      });
    }
  }

  next();
};

/**
 * Track username checks to prevent automated enumeration/scraping
 */
export const recordUsernameCheck = async (ip) => {
  if (!ip || isWhitelisted(ip)) return;
  const now = Date.now();
  const redis = getRedisClient();
  const key = `ls:ip:userchecks:${ip}`;
  const LIMIT = 50; // max distinct checks per window
  const WINDOW_SEC = 15 * 60; // 15 mins

  if (redis && isRedisConfigured()) {
    try {
      const count = await luaIncrExpire(redis, key, WINDOW_SEC);
      if (count >= LIMIT) {
        await blockIP(ip, `Username enumeration/scraping detected (${count} checks)`);
      }
    } catch (err) {
      logger.warn(`[DualRateLimit] Username check recording error: ${err.message}`);
    }
  } else {
    // Memory fallback — use a dedicated counter map for username checks
    const memChecks = memoryStore.accountAttempts.get(key) || { count: 0, expiresAt: now + WINDOW_SEC * 1000 };
    memChecks.count += 1;
    memChecks.expiresAt = Math.max(memChecks.expiresAt, now + WINDOW_SEC * 1000);
    memoryStore.accountAttempts.set(key, memChecks);
    if (memChecks.count >= LIMIT) {
      memoryStore.ipBlocks.set(ip, {
        blocked: true,
        reason: `Username enumeration/scraping detected (${memChecks.count} checks)`,
        blockedAt: now,
        blockedUntil: now + IP_BLOCK_SEC * 1000
      });
      logger.warn(`[Security Shield] IP BLOCKED (${ip}) globally: Username enumeration/scraping detected`);
    }
  }
};
