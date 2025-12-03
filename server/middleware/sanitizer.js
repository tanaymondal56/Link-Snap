/**
 * Input Sanitizer Middleware
 * Protects against NoSQL injection by sanitizing req.body, req.query, and req.params
 * Works alongside Zod validation for defense in depth
 */

// Recursively sanitize an object by removing keys starting with $ or containing .
const sanitize = (obj) => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(sanitize);
    }

    const sanitized = {};
    for (const key of Object.keys(obj)) {
        // Block MongoDB operators (keys starting with $) and dot notation attacks
        if (key.startsWith('$') || key.includes('.')) {
            continue; // Skip malicious keys
        }

        const value = obj[key];

        // Recursively sanitize nested objects
        if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitize(value);
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

    // In Express 5, req.query and req.params are read-only getters
    // We sanitize individual values in place instead of replacing the object
    if (req.query) {
        for (const key of Object.keys(req.query)) {
            if (key.startsWith('$') || key.includes('.')) {
                delete req.query[key];
            } else if (typeof req.query[key] === 'string') {
                req.query[key] = req.query[key].replace(/^\$/, '');
            }
        }
    }

    // For params, we attach sanitized version to a custom property
    if (req.params) {
        req.sanitizedParams = sanitize({ ...req.params });
    }

    next();
};

export default mongoSanitize;
