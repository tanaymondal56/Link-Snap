# Link-Snap: Bugs and Improvements (as of December 6, 2025)

## Recently Fixed Bugs ✅

1. **Ban Duration Display Issue** (Fixed: Dec 5, 2025)
   - **Problem**: When admin banned a user with temporary duration, UI showed "Permanent" until page refresh.
   - **Root Cause**: `handleBanUser` in `AdminDashboard.jsx` wasn't updating local state with `bannedUntil` field from API response.
   - **Fix**: Updated to use complete `data.user` object from API response instead of manual state construction.

2. **Email Verification Race Condition** (Fixed: Dec 5, 2025)
   - **Problem**: Clicking verification link showed both success AND error toasts, then "invalid token" error.
   - **Root Cause**: React Strict Mode runs useEffect twice, causing double API calls. First succeeds, second fails on consumed token.
   - **Fix**: Added `AbortController` and success tracking refs in `VerifyEmail.jsx`. Server updated to return "already verified" for consumed tokens.

3. **Dashboard Flash on Refresh** (Fixed: Dec 5, 2025)
   - **Problem**: Dashboard briefly showed login form on page refresh before authentication completed.
   - **Root Cause**: `loading` state resolved before `user` was populated from token validation.
   - **Fix**: Added check for `localStorage.getItem('accessToken')` in loading condition to prevent flash.

4. **Vite Build Cache Stale** (Fixed: Dec 6, 2025)
   - **Problem**: Version changes weren't reflected in production builds even after rebuilding.
   - **Root Cause**: Vite's `.vite` cache wasn't invalidated when `version.js` changed.
   - **Fix**: Clear `client/node_modules/.vite` before building to ensure fresh bundle.

5. **PWA Overlay Bypass via DevTools** (Fixed: Dec 5, 2025)
   - **Problem**: Users could remove PWA update overlay using DevTools, bypassing mandatory update.
   - **Fix**: Added `MutationObserver` to detect DOM tampering, invisible blocker div, keyboard event blocking, and periodic interval checks.

## Authentication Security Fixes ✅ (Dec 6, 2025)

1. **Weak Bcrypt Salt Rounds** ✅ FIXED
   - **Problem**: Was using 10 salt rounds, below OWASP minimum of 12.
   - **File**: `server/models/User.js`
   - **Fix**: Increased to `bcrypt.genSalt(12)` for stronger password hashing.

2. **Timing Attack Vulnerability on Login** ✅ FIXED
   - **Problem**: If user didn't exist, login returned faster than password comparison, revealing valid emails.
   - **File**: `server/controllers/authController.js`
   - **Fix**: Always performs password comparison against dummy hash when user doesn't exist.

3. **User Enumeration on Registration** ✅ FIXED
   - **Problem**: "User already exists" error revealed valid email addresses.
   - **File**: `server/controllers/authController.js`
   - **Fix**: Returns generic message "If this email is not already registered, you will receive a verification email shortly."

4. **Password Policy Mismatch** ✅ FIXED
   - **Problem**: Zod validator required 8 chars, but User model allowed 6.
   - **File**: `server/models/User.js`
   - **Fix**: Standardized model `minlength` to 8 characters.

5. **Access Token Too Long Expiry** ✅ FIXED
   - **Problem**: 1 hour expiry is too long, increases window for token abuse.
   - **File**: `server/utils/generateToken.js`
   - **Fix**: Reduced to 15 minutes (refresh token handles persistence).

### Authentication Security - Remaining Improvements

6. **No Account Lockout After Failed Attempts** (Not Yet Fixed)
   - **Risk**: Brute force possible even with rate limits (10/hour is generous).
   - **Recommendation**: Lock account after 5-10 failed attempts, require email unlock.

7. **Missing Password Complexity Validation** (Not Yet Fixed)
   - **Problem**: Only checks min length, not complexity (uppercase, lowercase, numbers, special chars).
   - **Recommendation**: Add regex validation for password strength.

8. **Login Attempts Not Rate Limited Per Account** (Not Yet Fixed)
   - **Problem**: Only IP-based rate limiting, no per-account limits.
   - **Recommendation**: Add per-account rate limiting with progressive delays.

## Potential Bugs

1. **Environment Variable Loading** ✅ FIXED (Dec 6, 2025)

   - **Problem**: If the server is started outside the root or with a different working directory, `.env` may not load, causing encryption or DB issues.
   - **File**: `server/config/env.js`
   - **Fix**: Added comprehensive startup validation:
     - Tries `.env` from server/ directory first, then root/
     - Checks for critical vars (MONGO_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET)
     - Warns on missing recommended vars (ENCRYPTION_KEY, NODE_ENV, PORT)
     - Fails fast in production if critical vars are missing
     - Logs success/warning/error messages for debugging

2. **Encryption Key Handling** ✅ FIXED (Dec 6, 2025)

   - **Problem**: If the ENCRYPTION_KEY is not exactly 32 bytes, encryption/decryption will fail. No fallback or warning is present.
   - **File**: `server/config/env.js`
   - **Fix**: Added validation that checks ENCRYPTION_KEY length is exactly 32 characters. Exits with error in production if invalid.

3. **Error Handling Consistency** ✅ FIXED (Dec 6, 2025)

   - **Problem**: Some API endpoints returned generic 500 errors without proper logging or context.
   - **File**: `server/controllers/adminController.js`
   - **Fix**: Updated 14 admin endpoints to use `next(error)` instead of direct `res.status(500).json()`. All errors now:
     - Go through centralized `errorHandler.js`
     - Get logged to `error.log` via winston with request context (URL, method, IP)
     - Return consistent JSON format `{ message, stack }`
     - Hide stack traces in production

4. **Database Connection Handling** ✅ FIXED (Dec 6, 2025)

   - **Problem**: If MongoDB is unavailable at startup, the server crashed immediately.
   - **File**: `server/config/db.js`
   - **Fix**: Added retry logic with exponential backoff:
     - Up to 5 retries with delays: 1s, 2s, 4s, 8s, 16s
     - Clear error messages at each retry attempt
     - Only exits in production after all retries exhausted
     - In development, throws error for debugging instead of exiting

5. **Frontend/Backend Sync** ✅ FIXED (Dec 6, 2025)

   - **Problem**: No way to check if API is reachable or database is connected.
   - **File**: `server/index.js`
   - **Fix**: Added health check endpoints:
     - `GET /health` - Basic check (uptime, timestamp)
     - `GET /health/deep` - Deep check (includes database status, returns 503 if DB disconnected)

6. **Password Handling** [FIXED]

   - **Issue**: Passwords are encrypted, but if the encryption fails, the plaintext may be saved or the operation may silently fail.
   - **Fix**: Added explicit `try/catch` block in `User` model `pre('save')` hook. verified that if encryption fails, a critical error is thrown ("Password encryption failed"), aborting the database save operation. This prevents plaintext passwords from indefinitely being stored.
   - **Verification**: Code review of `server/models/User.js` confirms error propagation. User creation/password change logic relies on `user.save()` which triggers this protected hook.

7. **Old Server Processes**
   - Multiple Node processes can cause port conflicts and stale code execution.
   - _Improvement_: Add a pre-start script to kill old processes on the same port.

8. **PWA Update Prompt Not Showing** (Under Investigation)
   - **Problem**: PWA update prompt may not appear reliably in all scenarios after version bump.
   - **Root Cause**: Service Worker update detection with `registerType: 'prompt'` requires `skipWaiting: false`.
   - **Status**: Fix implemented, needs field testing. Version mismatch detection added as fallback.

9. **Service Worker Caching Stale Content** [FIXED]
   - **Problem**: Old cached JS bundles served even after rebuild if server not restarted.
   - **Root Cause**: Service Worker (`sw.js`) was being cached by the browser/server, preventing immediate detection of new updates.
   - **Fix**: Updated `server/index.js` to serve `sw.js`, `workbox-*.js`, and `index.html` with STRICT `no-cache` headers.
   - **Verification**: Browser will now check for a new Service Worker on every page load. `PWAUpdatePrompt` component is already present in `App.jsx` to guide users to reload when an update is detected.

## Additional Findings from Full Codebase Scan

**New Findings from Latest Codebase Search:**

1. Sensitive credentials (MongoDB URI, JWT secrets, encryption key) are present in `.env`. Ensure `.env` is excluded from version control and secrets are rotated regularly.
2. Multiple uses of `process.env` for config, some with fallback/defaults (potential security risk if defaults are weak or exposed in production).
3. Console warnings for missing/unsafe config (e.g., CLIENT_URL, ENCRYPTION_KEY) are present. These should be reviewed and removed or replaced with proper error handling in production.
4. Danger color and alert logic in email templates. Ensure no sensitive information is exposed in emails and templates are sanitized.
5. Logging of errors and info in `combined.log`. Review log files for sensitive data and ensure log rotation and access control.
6. No direct TODO/FIXME comments found, but some warnings and fallback logic indicate areas for improvement and should be tracked.
7. **Client-side Token Storage** [FIXED]
   - **Problem**: `accessToken` stored in `localStorage` is vulnerable to XSS.
   - **Fix**: Refactored `client/src/context/AuthContext.jsx` and `client/src/api/axios.js` to store access tokens **in-memory only** (in a local variable).
   - **Verification**: On page reload, the app now uses the `HttpOnly` refresh token cookie to perform a "silent refresh" to get a new access token, completely bypassing `localStorage` for sensitive credentials.
9. No obvious unsafe DOM manipulation found in client, but a full audit for XSS/CSRF is recommended, especially for user-generated content.
10. Audit all uses of localStorage, process.env, and fallback/default logic for security and best practices.
11. Ensure all user input is validated and sanitized, especially in email templates and React components.

**Security Flaws & Vulnerabilities:**

1. Default Encryption Key Fallback: If ENCRYPTION_KEY is missing, a default key is used, making encrypted data vulnerable in production. Fail startup if ENCRYPTION_KEY is not set in production.
2. JWT Secret Management: JWT secrets in `.env` are not enforced to be strong/random. Weak secrets can lead to token forgery. Add a check for strong JWT secrets and rotate them regularly.
3. Token Expiry Handling: Expired JWTs return 401, but error messages may leak stack traces in development. Ensure production hides sensitive details.
4. Dependency Vulnerabilities: `npm audit` found vulnerabilities in `jws` (high severity) and `tmp` (no fix available). Monitor advisories and update/replace vulnerable dependencies.
5. Console Logging in Production: Debug logs (console.log, console.warn) are present in encryption and settings logic. May leak sensitive info in production. Remove or conditionally disable debug logs in production.
6. Helmet CSP Configuration: Helmet allows 'unsafe-inline' for scripts/styles in development. This is dangerous if left enabled in production. Ensure strict CSP in production, disallow 'unsafe-inline'.
7. NoSQL Injection Protection: Custom sanitizer is used, but explicit checks for `$` operators in user input are recommended. Audit all user input for NoSQL injection vectors.
8. Password Policy Enforcement: Registration enforces min 8 chars, but login allows any length. Consider enforcing strong password policy everywhere.
9. Rate Limiting Granularity: Rate limiting is present, but dashboard for monitoring and per-user quotas is not implemented. Add rate limit dashboard and granular controls.
10. Audit Logging Coverage: Login history is tracked, but admin actions and link changes may not be fully logged. Expand audit logging to all sensitive actions.
11. Backup and Restore: Automated database backups are not implemented. Add scheduled backups and restore functionality.
12. Frontend Security: No mention of XSS/CSRF protection in React components. Ensure all user input is sanitized and CSRF is handled for cookie-based APIs.
13. Sensitive Data in .env: Database credentials and secrets are stored in `.env`. Ensure `.env` is never committed and rotate secrets regularly.

**Scope of Improvements:**

1. ESLint Migration: ESLint v9+ requires `eslint.config.js`. Migration from `.eslintrc.*` is needed for linting to work. Migrate ESLint config and enforce linting in CI.
2. Dependency Audit Automation: No automated process for dependency vulnerability checks. Add CI step for `npm audit` and alert on new vulnerabilities.
3. Production Build Optimization: Vite config may include dev-only plugins in production. Ensure only necessary plugins are loaded. Audit Vite config for production safety.
4. Health Checks: Docker containers lack health checks for client/server. Add health check endpoints and Docker healthcheck instructions.
5. Test Coverage: No automated tests for critical flows (encryption, auth, link creation). Add unit/integration tests and measure coverage.

## Improvements

1. **Security**

   - Use environment variables for all secrets, not just the encryption key.
   - Add rate limiting and brute-force protection to login and sensitive endpoints.
   - Sanitize all user input, especially in URLs and email fields.

2. **Testing**

   - Add automated tests for encryption/decryption, API endpoints, and UI flows.
   - Use a test database for integration tests.

3. **Logging**

   - Use a logging library (like Winston or Pino) for structured logs.
   - Add request/response logging for critical endpoints.

4. **User Experience**

   - Show user-friendly error messages in the frontend for all API failures.
   - Add loading indicators and success/error toasts for async actions.

5. **Deployment**

   - Add Docker health checks for both client and server containers.
   - Use multi-stage builds to reduce Docker image size.

6. **Code Quality**

   - Enforce linting and formatting with ESLint and Prettier.
   - Use TypeScript for type safety (if not already).

7. **Performance**

   - Cache frequently accessed data (like settings) in memory.
   - Optimize MongoDB queries with proper indexes.

8. **Documentation**
   - Expand README with setup, troubleshooting, and contribution guidelines.
   - Document all environment variables and their required formats.

---

_If you want a deep-dive code review or want to focus on a specific area (security, performance, UX, etc.), let me know!_
