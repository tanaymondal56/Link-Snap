/**
 * Input Sanitizer Middleware
 * Protects against NoSQL injection by sanitizing req.body, req.query, and req.params
 * Works alongside Zod validation for defense in depth
 */

// Dangerous keys that could lead to prototype pollution
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Maximum recursion depth to prevent stack overflow on deeply nested/circular objects
const MAX_DEPTH = 20;

// Recursively sanitize an object by removing keys starting with $ or containing .
const sanitize = (obj, depth = 0) => {
    // Prevent stack overflow on deeply nested or circular objects
    if (depth > MAX_DEPTH) {
        return obj;
    }

    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitize(item, depth + 1));
    }

    const sanitized = {};
    for (const key of Object.keys(obj)) {
        // Block MongoDB operators (keys starting with $), dot notation attacks, and prototype pollution
        if (key.startsWith('$') || key.includes('.') || BLOCKED_KEYS.has(key)) {
            continue; // Skip malicious keys
        }

        const value = obj[key];

        // Recursively sanitize nested objects
        if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitize(value, depth + 1);
        } else if (typeof value === 'string') {
            // Remove any $ at the start of string values (potential injection)
            sanitized[key] = value.replace(/^\$/, '');
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
};

export const mongoSanitize = (req, res, next) => {
    // Sanitize req.body (mutable)
    if (req.body) {
        req.body = sanitize(req.body);
    }

    // Sanitize req.query
    if (req.query) {
        const sanitizedQuery = sanitize(req.query);
        // req.query is a getter in some contexts, so we must mutate the object in place
        for (const key in req.query) {
            delete req.query[key];
        }
        Object.assign(req.query, sanitizedQuery);
    }

    // Sanitize req.params
    if (req.params) {
        const sanitizedParams = sanitize(req.params);
        // Same safety for req.params
        for (const key in req.params) {
            delete req.params[key];
        }
        Object.assign(req.params, sanitizedParams);
    }

    next();
};

export default mongoSanitize;
