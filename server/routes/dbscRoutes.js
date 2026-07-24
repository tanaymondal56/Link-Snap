import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Session from '../models/Session.js';
import logger from '../utils/logger.js';

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
  const proofHeader = req.headers["secure-session-response"];

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
    const dbscSessionId = req.headers["sec-secure-session-id"];
    const jwtCookie = req.cookies?.['jwt'];
    
    if (!dbscSessionId && !jwtCookie) {
      return res.status(400).json({ error: "Missing session identifier" });
    }

    let session;
    if (dbscSessionId) {
      session = await Session.findOne({ dbscSessionId });
    } else {
      const tokenHash = crypto.createHash('sha256').update(jwtCookie).digest('hex');
      session = await Session.findOne({ tokenHash });
    }

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Cryptographically bind public key to this session and mark DBSC as enforced
    session.dbscPublicKeyJwk = jwk;
    session.dbscEnforced = true;  // From this point, authMiddleware enforces hardware binding
    session.dbscChallenge = null; // Clear any pending challenge
    await session.save();

    // Chrome DBSC specification: include_site must be false for public suffix domains (e.g. qzz.io, vercel.app, github.io)
    // and localhost, to prevent session scope leakage across un-owned subdomains.
    return res.status(200).json({ 
      session_identifier: session.dbscSessionId,
      scope: {
        include_site: false
      },
      credentials: [
        {
          type: "cookie",
          name: "session"
        },
        {
          type: "cookie",
          name: "jwt"
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
  const dbscSessionId = req.headers["sec-secure-session-id"];
  const jwtCookie = req.cookies?.['jwt'];
  const proofHeader = req.headers["secure-session-response"];

  if (!dbscSessionId && !jwtCookie) {
    return res.status(400).json({ error: "Missing session identifier" });
  }

  let session;
  if (dbscSessionId) {
    session = await Session.findOne({ dbscSessionId });
  } else {
    const tokenHash = crypto.createHash('sha256').update(jwtCookie).digest('hex');
    session = await Session.findOne({ tokenHash });
  }

  if (!session || !session.dbscPublicKeyJwk) {
    // Session not found or no DBSC key registered — issue a fresh challenge
    const newChallenge = crypto.randomBytes(16).toString("hex");
    res.setHeader("Secure-Session-Challenge", `challenge="${newChallenge}"; id="${dbscSessionId || 'unknown'}"`);
    return res.status(403).json({ error: "DBSC challenge required" });
  }

  if (!proofHeader) {
    // Phase 1: Browser is initiating — issue and PERSIST the challenge (anti-replay)
    const newChallenge = crypto.randomBytes(16).toString("hex");
    session.dbscChallenge = newChallenge;
    await session.save();
    res.setHeader("Secure-Session-Challenge", `challenge="${newChallenge}"; id="${session.dbscSessionId}"`);
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
    await session.save();

    // The token is valid. Return 200 OK to tell the browser to unpause the queued requests.
    return res.status(200).json({ continue: true });
  } catch (err) {
    logger.error(`[DBSC Refresh Error] ${err.message}`);
    return res.status(401).json({ error: "Invalid device signature", details: err.message, stack: err.stack });
  }
});

export default router;
