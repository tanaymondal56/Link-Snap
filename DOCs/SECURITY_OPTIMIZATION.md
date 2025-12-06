# Link Snap - Security, Optimization & Efficiency Strategy (Comprehensive)

## 1. Security Architecture (Fortress Level)

### A. Authentication & Session Management

- **JWT Strategy (The "Double Token" Pattern)**:
  - **Access Token**: Short-lived (15 min). Stored in memory (variable) or HttpOnly Cookie.
  - **Refresh Token**: Long-lived (7 days). Stored in HttpOnly, Secure, SameSite=Strict Cookie.
  - _Crucial Rule_: **Do NOT store JWTs in localStorage** (vulnerable to XSS).
- **CSRF Protection**: Essential when using cookies. Use `csurf` or the "Double Submit Cookie" pattern for stateless verification.
- **Password Security**: Use `bcrypt` with a work factor (salt rounds) of at least 12. Enforce strong password policies (min length, special chars) using Zod.
- **Email Verification**: Optional email verification flow with cryptographic tokens (24hr expiry). Configurable via admin Settings panel.

### B. Input Validation & Sanitization

- **Zod Validation**: Use `zod` for strict schema validation on all incoming request bodies.
  - Ensure URLs are valid HTTP/HTTPS protocols (prevent `javascript:` URIs).
  - Sanitize "Custom Alias" to prevent injection or offensive terms.
- **NoSQL Injection Protection** (`server/middleware/sanitizer.js`):
  - Custom `mongoSanitize` middleware applied globally.
  - Recursively sanitizes `req.body`, `req.query`, and `req.params`.
  - Blocks MongoDB operators (keys starting with `$`) and dot notation attacks.
  - Removes `$` from start of string values to prevent injection.

### C. Network & Request Security

- **Content Security Policy (CSP)**: Configure Helmet to set a strict CSP. This prevents XSS by only allowing scripts from trusted domains (e.g., our own domain + Google Analytics).
- **CORS Policy**: Whitelist only the specific frontend domain (and localhost for dev). Block all other origins.
- **Rate Limiting (Granular)**:
  - Use `express-rate-limit` backed by Redis.
  - _Rules_: `/api/auth/*` (5/15min), `/api/url/shorten` (10/min), `/:shortId` (Unlimited but monitored).
- **HPP (HTTP Parameter Pollution)**: Use `hpp` middleware to prevent attacks that exploit duplicate query parameters.
- **Information Hiding**: Disable `X-Powered-By` header. Ensure API errors do not leak stack traces in production.

### D. Admin Panel Security

- **IP Whitelist Protection** (`server/middleware/ipWhitelist.js`):
  - Admin routes are protected by IP-based allowlist.
  - Only localhost is allowed by default; additional IPs can be configured.
  - Uses socket IP (not headers) to prevent IP spoofing.
  - Returns **404 Not Found** (not 403) to hide existence of admin routes.
- **Admin Role Verification** (`server/middleware/verifyAdmin.js`):
  - Double-layer protection: IP whitelist + role check.
  - Returns 404 to hide admin routes from unauthorized users.
- **Login History Tracking** (`server/models/LoginHistory.js`):
  - Records all login attempts (success/failure) with IP, user agent, and reason.
  - Indexed for quick lookups by userId, IP, or email.
  - Enables detection of brute force attacks and account security audits.

### E. Operational Security

- **Audit Logging**: Create a separate `AuditLog` collection. Record every critical action (User Ban, Link Deletion, Role Change).
- **Dependency Scanning**: Integrate `npm audit` or Snyk into the CI/CD pipeline.
- **Secret Management**: Never commit `.env`. Use a secrets manager in production.

### F. Ban & Appeal System (Enhanced)

- **Secure Appeal Token**:
  - When a banned user attempts login, they receive a 403 Forbidden with a specialized, short-lived JWT (`appealToken`).
  - This token is cryptographically linked to the specific user and ban session.
  - **Security Benefit**: Prevents "Appeal Spoofing" where a malicious actor could submit appeals for others by guessing emails. The appeal form is read-only and relies solely on this token.
- **Appeal Limits**:
  - Enforced limit of **3 appeals** per suspension period.
  - Counter resets automatically if the user is unbanned and re-banned (new `bannedAt` timestamp).
  - Prevents spamming the admin panel with endless appeals.
- **"Unban Pending" State**:
  - Admins can "Approve" an appeal without immediately unbanning the user.
  - Useful for probationary periods or requiring further action (e.g., "Delete the malicious link first").
  - System logs this specific state in `BanHistory`.
- **Link Disabling on Ban**:
  - Option to disable all user's links when banned (`disableLinksOnBan` flag).
  - Redirect controller checks user ban status and returns 403 for disabled links.
  - Links are automatically re-enabled when user is unbanned.
- **Temporary Ban Scheduler** (`server/services/banScheduler.js`):
  - Background job runs every minute to check for expired bans.
  - Automatically unbans users when `bannedUntil` expires.
  - Sends reactivation email notification to unbanned users.
  - Logs action in `BanHistory` with `temp_ban_expired` type.
  - Invalidates cache for user's links upon unban.
- **Ban History Tracking**:
  - Comprehensive log of all actions: `ban`, `unban`, `appeal_approved`, `temp_ban_expired`.
  - Records who performed the action (Admin ID) and the reason.

### G. PWA Security (Frontend)

- **Tamper-Resistant Update Prompt** (`client/src/components/PWAUpdatePrompt.jsx`):
  - Uses MutationObserver to detect and re-create overlay if removed via DevTools.
  - Invisible blocker div intercepts all pointer and keyboard events.
  - Body scroll lock prevents interaction with underlying app.
  - Periodic interval check as backup detection mechanism.
  - Users **cannot bypass** the mandatory update prompt.

---

## 2. Performance Optimization (Speed & Scale)

### A. Database Tuning (MongoDB)

- **Compound Indexes**:
  - `{ createdBy: 1, createdAt: -1 }`: Optimizes "My Links" query.
  - `{ urlId: 1, timestamp: -1 }`: Optimizes Analytics queries.
- **TTL Indexes**: Automatically delete anonymous links after 24 hours.
- **Connection Pooling**: Configure Mongoose `poolSize` to maintain open connections.

### B. Caching Strategy (Multi-Layer)

- **Redis (Hot Data)**:
  - **Redirect Cache**: Key: `url:{shortId}`, Value: `originalUrl`. TTL: 1 hour.
  - **User Session**: Cache user profile data.
- **CDN**: Serve Frontend assets (JS, CSS, Images) via Cloudflare/Vercel Edge.

### C. Backend Throughput

- **Compression**: Use `compression` middleware (Gzip/Brotli).
- **Clustering**: Use `PM2` to run Node.js in Cluster Mode (utilizing all CPU cores).
- **Asynchronous Processing**: Offload heavy tasks (e.g., CSV exports) to a background worker queue (BullMQ).

### D. Frontend Performance (Core Web Vitals)

- **Code Splitting (Restored)**: Use React `lazy` and `Suspense` to load Dashboard and Admin Panel chunks only when needed.
- **Debouncing (Restored)**: Debounce "Search" inputs to prevent API flooding.
- **Optimistic UI (Restored)**: Show created links immediately in the list before server confirmation.
- **Tree Shaking**: Ensure unused code is not bundled.
- **PWA Capabilities**: Service Worker for caching the App Shell.

---

## 3. Efficiency & Maintainability (DevOps)

### A. Architecture Patterns

- **Service Layer Pattern**: Separate Controller (HTTP) from Service (Logic) from Repository (DB).
- **Analytics Separation (Restored)**: Keep Analytics in a separate collection. Use MongoDB Aggregation Framework for stats calculation to keep Node.js event loop free.
- **API Versioning**: Prefix routes with `/api/v1`.

### B. Observability

- **Structured Logging**: Use `winston` to log as JSON with `correlationId`.
- **Error Tracking**: Integrate Sentry/GlitchTip.
- **Health Checks**: `/health` and `/health/deep` endpoints.

### C. Infrastructure

- **Dockerization**: `Dockerfile` and `docker-compose.yml` for consistent environments.
- **CI/CD**: GitHub Actions for Linting, Testing, and Deployment.
