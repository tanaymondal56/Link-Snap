import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Session from '../models/Session.js';
import logger from '../utils/logger.js';
import { setDbscSessionCookies } from '../controllers/authController.js';

const router = express.Router();

/**
 * 1. DBSC REGISTRATION ENDPOINT
 * Handles POST /api/dbsc/registration
 * The browser posts its ES256 JWS proof containing the new hardware public key.
 * On success:
 *  - Binds the public key to the session
 *  - Sets dbscEnforced=true on the session record
 *  - The caller should then issue a NEW access token with dbscEnforced=true embedded
 */
router.post('/registration', async (req, res) => {
  const proofHeader = req.headers["secure-session-response"] || req.headers["sec-session-response"];

  if (!proofHeader) {
    return res.status(400).json({ error: "Missing Secure-Session-Response header" });
  }

  try {
    // Decode JWS header & payload
    const decoded = jwt.decode(proofHeader, { complete: true });
    if (!decoded || !decoded.header?.jwk) {
      return res.status(400).json({ error: "Invalid JWS proof format" });
    }

    const { jwk } = decoded.header;
    const payload = decoded.payload; // Contains jti and aud
    
    // We expect jti to match the challenge we sent in the Secure-Session-Registration header
    if (!payload || !payload.jti) {
      return res.status(400).json({ error: "Missing jti in JWS payload" });
    }

    // Convert JWK public key to PEM and verify signature against challenge JTI
    const publicKeyPem = crypto.createPublicKey({ format: "jwk", key: jwk }).export({ format: "pem", type: "spki" });
    jwt.verify(proofHeader, publicKeyPem, { algorithms: ["ES256", "RS256"] });

    // The browser sends the session ID via cookie or custom header
    const dbscSessionId = req.headers["sec-secure-session-id"] || req.headers["sec-session-id"] || req.cookies?.['__Host-session'] || req.cookies?.['dbsc_session'];
    const jwtCookie = req.cookies?.['jwt'];
    
    if (!dbscSessionId && !jwtCookie) {
      return res.status(400).json({ error: "Missing session identifier" });
    }

    let session;
    if (dbscSessionId) {
      session = await Session.findOne({ dbscSessionId });
    }
    if (!session && jwtCookie) {
      const tokenHash = crypto.createHash('sha256').update(jwtCookie).digest('hex');
      session = await Session.findOne({ 
        $or: [
          { tokenHash },
          { previousTokenHash: tokenHash }
        ]
      });
    }

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Verify the challenge nonce — prevents a malicious JWS from registering a key to an arbitrary session
    if (!session.dbscChallenge || payload.jti !== session.dbscChallenge) {
      logger.warn(`[DBSC Registration] Challenge mismatch for session ${session.dbscSessionId}`);
      return res.status(401).json({ error: "Registration challenge mismatch: jti does not match stored nonce" });
    }

    // Cryptographically bind public key to this session and mark DBSC as enforced
    session.dbscPublicKeyJwk = jwk;
    session.dbscEnforced = true;  // From this point, authMiddleware enforces hardware binding
    session.dbscChallenge = null; // Clear any pending challenge
    session.dbscLastVerifiedAt = new Date();
    await session.save();

    // Import generateAccessToken dynamically to avoid circular dependencies
    const { generateAccessToken } = await import('../utils/generateToken.js');
    const MasterAdmin = (await import('../models/MasterAdmin.js')).default;
    const isMaster = await MasterAdmin.exists({ _id: session.userId });
    const role = isMaster ? 'master_admin' : 'user';
    const accessToken = generateAccessToken(session.userId, role, session.dbscSessionId, true);

    // Set Chrome DBSC specification headers and hardware session cookie
    const termHeader = `(continue); id="${session.dbscSessionId}"`;
    res.setHeader("Sec-Session-Response", termHeader);
    res.setHeader("Secure-Session-Response", termHeader);

    setDbscSessionCookies(res, session.dbscSessionId);

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    // Chrome DBSC specification response format
    return res.status(200).json({ 
      session_identifier: session.dbscSessionId,
      refresh_url: "/api/dbsc/refresh",
      accessToken,
      dbscEnforced: true,
      scope: {
        include_site: false
      },
      credentials: [
        {
          type: "cookie",
          name: "__Host-session",
          attributes: "Secure; Path=/; SameSite=Lax; HttpOnly"
        },
        {
          type: "cookie",
          name: "dbsc_session",
          attributes: "Secure; Path=/; SameSite=Lax; HttpOnly"
        },
        {
          type: "cookie",
          name: "access_token",
          attributes: "Secure; Path=/; SameSite=Lax; HttpOnly"
        },
        {
          type: "cookie",
          name: "jwt",
          attributes: "Secure; Path=/; SameSite=Lax; HttpOnly"
        },
        {
          type: "cookie",
          name: "session",
          attributes: "Secure; Path=/; SameSite=Lax; HttpOnly"
        }
      ]
    });
  } catch (err) {
    logger.error('[DBSC Registration Error]', err.message);
    return res.status(401).json({ error: "DBSC proof verification failed", details: err.message, stack: err.stack });
  }
});

/**
 * 2. DBSC REFRESH ENDPOINT (Deferred Fetch)
 * Handles POST /api/dbsc/refresh
 * The browser pauses outgoing requests when a cookie is about to expire,
 * and calls this to prove possession of the hardware key.
 *
 * TWO-PHASE flow:
 *  Phase 1 (no proof header): Issue a new challenge, store it in DB. Return 403 + Secure-Session-Challenge.
 *  Phase 2 (with proof header): Verify the JWS proof's jti matches the stored challenge. If valid, return 200.
 *
 * The stored challenge is single-use (cleared after verification) to prevent replay attacks.
 */
router.post('/refresh', async (req, res) => {
  const dbscSessionId = req.headers["sec-secure-session-id"] || req.headers["sec-session-id"] || req.cookies?.['__Host-session'] || req.cookies?.['dbsc_session'];
  const jwtCookie = req.cookies?.['jwt'];
  const proofHeader = req.headers["secure-session-response"] || req.headers["sec-session-response"];

  if (!dbscSessionId && !jwtCookie) {
    return res.status(400).json({ error: "Missing session identifier" });
  }

  let session;
  if (dbscSessionId) {
    session = await Session.findOne({ dbscSessionId });
  }
  if (!session && jwtCookie) {
    const tokenHash = crypto.createHash('sha256').update(jwtCookie).digest('hex');
    session = await Session.findOne({ 
      $or: [
        { tokenHash },
        { previousTokenHash: tokenHash }
      ]
    });
  }

  if (!session || !session.dbscPublicKeyJwk) {
    // Session not found or no DBSC key registered — issue a fresh challenge
    // Sec-Session-Challenge format per DBSC spec & Chromium parser: "<nonce>"; id="<id>"
    // NOTE: The challenge string MUST be the primary RFC 8941 Item (do NOT put "challenge=" before it)
    const newChallenge = crypto.randomBytes(32).toString("base64url");
    const chalHeader = `"${newChallenge}"; id="${dbscSessionId || 'unknown'}"`;
    res.setHeader("Sec-Session-Challenge", chalHeader);
    res.setHeader("Secure-Session-Challenge", chalHeader);
    return res.status(403).json({ error: "DBSC challenge required" });
  }

  if (!proofHeader) {
    // Phase 1: Browser is initiating — issue and PERSIST the challenge (anti-replay)
    // Sec-Session-Challenge format per DBSC spec & Chromium parser: "<base64url-nonce>"; id="<id>"
    // NOTE: The challenge string MUST be the primary RFC 8941 Item (do NOT put "challenge=" before it)
    const newChallenge = crypto.randomBytes(32).toString("base64url");
    session.dbscChallenge = newChallenge;
    await session.save();
    const chalHeader = `"${newChallenge}"; id="${session.dbscSessionId}"`;
    res.setHeader("Sec-Session-Challenge", chalHeader);
    res.setHeader("Secure-Session-Challenge", chalHeader);
    return res.status(403).json({ error: "DBSC challenge required" });
  }

  // Phase 2: Verify Proof of Possession
  try {
    // Decode and verify the challenge JTI BEFORE signature to prevent replay attacks
    const decodedProof = jwt.decode(proofHeader, { complete: true });
    if (!decodedProof?.payload?.jti) {
      return res.status(401).json({ error: "Invalid proof: missing jti claim" });
    }

    // Verify the jti matches the stored (single-use) challenge
    if (!session.dbscChallenge || decodedProof.payload.jti !== session.dbscChallenge) {
      logger.warn(`[DBSC] Replay attack detected for session ${session.dbscSessionId}: jti mismatch`);
      return res.status(401).json({ error: "Replay attack detected: challenge mismatch" });
    }

    // Now verify the cryptographic signature
    const publicKeyPem = crypto.createPublicKey({ format: "jwk", key: session.dbscPublicKeyJwk }).export({ format: "pem", type: "spki" });
    jwt.verify(proofHeader, publicKeyPem, { algorithms: ["ES256", "RS256"] });

    // Challenge consumed — clear it immediately (single-use)
    session.dbscChallenge = null;
    session.dbscLastVerifiedAt = new Date();
    await session.save();
    setDbscSessionCookies(res, session.dbscSessionId);

    const termHeader = `(continue); id="${session.dbscSessionId}"`;
    res.setHeader("Sec-Session-Response", termHeader);
    res.setHeader("Secure-Session-Response", termHeader);

    // The token is valid. Return 200 OK with full session configuration to tell browser to unpause queued requests.
    return res.status(200).json({ 
      session_identifier: session.dbscSessionId,
      refresh_url: "/api/dbsc/refresh",
      continue: true 
    });
  } catch (err) {
    logger.error(`[DBSC Refresh Error] ${err.message}`);
    return res.status(401).json({ error: "Invalid device signature", details: err.message, stack: err.stack });
  }
});

export default router;
