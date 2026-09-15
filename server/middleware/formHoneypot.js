import { getUserIP } from './strictProxyGate.js';
import { recordViolation, isWhitelisted } from '../services/restrictedZoneService.js';
import logger from '../utils/logger.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FORM HONEYPOT & QUICK-SUBMIT SPEED GATE MIDDLEWARE
 * ═══════════════════════════════════════════════════════════════════════════════
 * Zero-client-overhead bot protection for form submissions & API mutations.
 * 
 * Detects:
 * 1. Honeypot traps: Automated scrapers filling hidden dummy fields (`_hp_website`, `_hp_trap`)
 *    -> Immediate 24-hour hard block (Tier 3).
 * 2. Quick-submit bursts: Form submitted faster than humanly possible (< 800ms)
 *    -> Strike recorded, request rejected with 429.
 * 
 * Sanitizes req.body so downstream controllers receive clean data.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const HONEYPOT_FIELDS = ['_hp_website', '_hp_trap', 'website_hp'];
const MIN_SUBMISSION_TIME_MS = 800; // Human cannot read & submit in < 800ms

/**
 * Express middleware to validate form honeypots and submission speed.
 * 
 * @param {object} options
 * @param {boolean} [options.requireTimestamp=false] - Whether _hp_ts is strictly required
 * @param {number} [options.minTimeMs=800] - Minimum elapsed time in milliseconds
 */
export const formHoneypotGate = (options = {}) => {
    const { requireTimestamp = false, minTimeMs = MIN_SUBMISSION_TIME_MS } = options;

    return async (req, res, next) => {
        // Only inspect state-altering requests with a body
        if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
            return next();
        }

        if (!req.body || typeof req.body !== 'object') {
            return next();
        }

        const clientIP = getUserIP(req);

        // Exempt whitelisted IPs (e.g. dev/local testing/admins)
        if (isWhitelisted(clientIP)) {
            // Clean up any potential honeypot fields
            for (const field of HONEYPOT_FIELDS) {
                delete req.body[field];
            }
            delete req.body._hp_ts;
            return next();
        }

        // 1. Check Honeypot Trap Fields
        for (const field of HONEYPOT_FIELDS) {
            const trapVal = req.body[field];
            if (trapVal !== undefined && trapVal !== null && String(trapVal).trim().length > 0) {
                logger.warn(`[FormHoneypot] 🚨 Honeypot triggered by ${clientIP} on ${req.originalUrl} via field '${field}'`);

                // Immediate 24-hour Hard Jail (Tier 3)
                await recordViolation(clientIP, 'honeypot_trap', {
                    field,
                    value: String(trapVal).slice(0, 50),
                    path: req.originalUrl,
                }, true);

                return res.status(403).json({
                    error: 'Access Denied',
                    code: 'BOT_TRAP_TRIGGERED',
                    message: 'Automated submission detected and blocked.',
                });
            }
        }

        // 2. Check Submission Speed Gate (Quick-Submit)
        const ts = req.body._hp_ts;
        if (ts !== undefined && ts !== null) {
            const submittedAt = Number(ts);
            if (!isNaN(submittedAt)) {
                const now = Date.now();
                const elapsed = now - submittedAt;

                if (elapsed >= 0 && elapsed < minTimeMs) {
                    logger.warn(`[FormHoneypot] ⚡ Quick-submit bot detected from ${clientIP} on ${req.originalUrl} (${elapsed}ms < ${minTimeMs}ms)`);

                    // Record Strike for rapid submit
                    const jailResult = await recordViolation(clientIP, 'quick_submit', {
                        elapsedMs: elapsed,
                        thresholdMs: minTimeMs,
                        path: req.originalUrl,
                    });

                    return res.status(429).json({
                        error: 'Submission Too Fast',
                        code: 'QUICK_SUBMIT_BLOCKED',
                        message: 'Form was submitted unnaturally fast. Please slow down and try again.',
                        retryAfter: jailResult?.durationSeconds || 60,
                    });
                }
            }
        } else if (requireTimestamp) {
            // Required timestamp missing from client request
            return res.status(400).json({
                error: 'Invalid Submission',
                code: 'TIMESTAMP_MISSING',
                message: 'Security verification token is missing.',
            });
        }

        // 3. Clean up request body so downstream controllers don't see honeypot fields
        for (const field of HONEYPOT_FIELDS) {
            delete req.body[field];
        }
        delete req.body._hp_ts;

        next();
    };
};

export default formHoneypotGate;
