# Changelog

All notable changes to Link-Snap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [7.1.0] - 2026-07-16

### Redis API Offloading, Custom Bloom Filters & Performance Hardening

This minor release implements high-performance Redis cache-aside patterns for read-heavy endpoints, introduces a custom Redis Bloom filter engine optimized for Upstash, and hardens the application against Cache Penetration attacks.

### 🧠 Custom Redis Bloom Filter Engine (Module-less Upstash Optimization)
- **Standard Redis Bitwise Operations:** Designed a high-speed Bloom filter utilizing standard Redis `SETBIT` and `GETBIT` pipelines, bypassing the need for the native `RedisBloom` module on Upstash HTTP environments.
- **Dynamic Case-Sensitivity:** Optimized hashing to run case-insensitively for usernames (preventing registration duplicates) and case-sensitively for short URL IDs (maximizing entropy and reducing collisions).
- **Concurrency & Lock Control:** Gated multi-replica startup seeding with a distributed lock (`ls:lock:bf:seeding`), allowing only one pod to populate the filters.
- **Zero-Downtime Rebuilds:** Implemented atomic swaps using Redis `RENAME` to prevent transient false-negatives during weekly background DB syncs.
- **Shielding (Cache Penetration):** Intercepts username checks and URL redirects early; if the filter returns `false`, database and cache lookups are bypassed entirely (immediate 404/available response).

### 🚀 High-Impact Redis Caching (API Offloading)
- **Link Analytics Cache:** Cached compiled analytics response payloads (`ls:analytics:{urlId}:{tier}`) with a 3-minute TTL, utilizing subscription-tier-specific keys to prevent cross-tier data leaks.
- **Analytics Payload Compression:** Automatically compresses cached analytics JSON responses exceeding 50KB using Gzip before saving to Redis, saving network I/O and RAM.
- **Lander Optimization:** Cached public changelogs (`ls:changelog:public`) and roadmaps (`ls:changelog:roadmap`) in Redis with O(1) cache invalidations on admin changes.
- **Notification Counter Caching:** Capped admin notification aggregate hits by caching unread count severity tallies with auto-invalidations on mark-as-read actions.
- **Admin Stats Cache:** Cached expensive global cluster counts (`ls:admin:stats`) with immediate invalidations when admins create or delete users.
- **Active Bio Invalidation:** Integrated immediate cache purges (`ls:bio:{username}`) on user dashboard profile updates, username changes, user bans, unbans, or account deletions.

### ⚡ Performance & Parallelism
- **Concurrent DB Queries:** Replaced serial MongoDB lookups with parallel `Promise.all` aggregates for global stats and notification queries.
- **Stateless Auth Cache:** Optimized the stateless JWT authentication middleware by caching hydrated user documents (`ls:user:{id}`) instead of database sessions.

---

## [7.0.1] - 2026-07-15

### Security Hardening, Performance Optimizations & OTP Overhaul

This patch release addresses critical performance issues, security vulnerabilities, and UX improvements in the authentication, click tracking, caching, and CI/CD systems.

### 🛡️ Security Hardening
- **Cryptographically Secure OTPs:** Replaced insecure `Math.random()` OTP generation functions with Node's native, cryptographically secure `crypto.randomInt()`.
- **Hashed Reset Tokens:** Implemented SHA256 hashing for password reset tokens before saving them in the database to protect them against database disclosure (defense-in-depth).
- **Zod Error Extraction:** Fixed a crash where Zod validation errors threw `Cannot read properties of undefined (reading '0')` due to Zod v4 syntax differences, ensuring clean validation errors are returned to the client.
- **Atomic Cache Invalidation & Attempt Rate Limiter (OTP Protection):** Upgraded `authController` OTP endpoints to track failed verification attempts. Users are allowed up to 3 tries per generated OTP. If the 3-attempt limit is reached, the OTP cache is instantly deleted in Redis to prevent brute-force attacks, while showing remaining attempt counts on incorrect attempts.

### 🏗️ Infrastructure & Workflows
- **Redis 8 Upgrade:** Standardized deployments to `redis:8-alpine` to leverage throughput optimizations and updated Node helpers to utilize atomic commands across both local and Upstash drivers.
- **K8s Storage Management:** Injected a privileged `nsenter` cleanup step in `deploy-beta` and `deploy-production` pipelines to forcefully prune unused container images (`k3s crictl rmi --prune` and `docker system prune -a`) on target nodes immediately after rollouts, preventing disk exhaustion.
- **Lint Workflow Optimization:** Excluded the `working` branch from the `.github/workflows/lint.yml` trigger to save action minutes.


### 🚀 Performance & Optimizations
- **N+1 Query Fix in Click Processing:** Eliminated a performance bottleneck in `trackBulkClicks` by replacing sequential `Url.findOne()` queries with a single batch `Url.find()` and a fast O(1) Map lookup.
- **PM2 Cluster Mode:** Configured `ecosystem.config.cjs` with `instances: "max"` and `exec_mode: "cluster"` to run Node.js across all 4 CPU cores.
- **Distributed Locking:** Added a Redis distributed lock (`ls:lock:flush` via `SET NX EX 10`) to the background `flushBuffer` cron job, preventing race conditions and duplicate writes in PM2 cluster mode.
- **Idle Caching Bypass:** Added a `pendingClickCount` tracker to prevent doing redundant Redis scans when there are no new clicks on the server.
- **Scan API Fix:** Replaced raw `redis.scan()` with the custom `redisScan` wrapper inside the cache clearing API to ensure compatibility with Upstash Redis REST.
- **Redis-First OTP Caching:** Configured Redis as the primary memory cache for active verification and reset OTP codes (10 min TTL) with MongoDB acting as a backup fallback.

### ✨ UX Improvements & UI Updates
- **Interactive Password Validator:** Added an interactive, on-the-fly checklist in the registration screen that validates the password against complexity requirements (uppercase, lowercase, digits, and length) as the user types.
- **Autofill Disabling:** Turned off browser auto-suggestions/autofill on OTP input fields using the standard `autoComplete="one-time-code"`.
- **One-Click Paste Code:** Created a "Paste Code" button on OTP input fields using the browser Clipboard API to let users instantly copy-paste 6-digit codes.
- **Spam Warning Highlight:** Highlighted spam folder check instructions on registration and password reset OTP screens for better visibility.
- **Zod Schema Fix:** Added `.or(z.literal(''))` to the phone validator in profile updates to prevent saving errors when the phone number field is cleared.

### 🐳 CI/CD Pipelines
- **Trigger Hardening:** Removed the deprecated `major/k8s` branch trigger from `docker-publish.yml` to prevent accidental triggers.

---

## [7.0.0] - 2026-07-14

### Major Overhaul: Security, Independent Deployments & Cloudflare Integration

This major release completely overhauls the deployment architecture and network security, transitioning to decoupled microservice deployments while hardening the pipeline with automated security testing.

### 🛡️ Network Security & Cloudflare Integration
- **Cloudflare Secure Network:** Fully integrated Cloudflare Tunnel (`cloudflared`) to proxy all backend traffic, establishing a highly secure, isolated network for the backend without exposing raw IPs to the public web.
- **Global CDN & Performance:** Leveraged Cloudflare's edge network for comprehensive CDN caching and DDoS protection.
- **In-Cluster Redis:** Successfully deployed a fully integrated, secure in-cluster Redis caching layer to support high-speed backend data management.

### 🏗️ Independent Deployments & Architecture
- **Decoupled Architecture:** Shifted from a monolith approach to completely independent frontend and backend deployments, enabling zero-downtime, independent scalable rollouts.
- **Admin Panel Telemetry:** Added Comprehensive Infrastructure info inside the Admin Panel to monitor cluster resource metrics and environment settings.
- **Smart Path Filtering:** Implemented `dorny/paths-filter` in CI/CD to automatically skip Kubernetes rollout jobs if only frontend or documentation files are modified, saving massive amounts of deployment time.

### 🔒 Automated Security Testing & CI/CD
- **Automated Workflow Audits:** Integrated strict automated testing and security scans into the GitHub workflow, extracting `npm audit` into dedicated blocking jobs and using `actionlint` for deep static analysis of all CI files.
- **Docker Security Scanning:** Implemented recursive `hadolint` scanning to enforce Docker security best practices and prevent insecure image builds.
- **Unified Pipeline:** Merged separate build and deployment jobs into a single highly optimized `docker-publish.yml` pipeline with concurrency gates to prevent overlapping deployment race conditions.
- **Resource Optimization:** Enabled the `Recreate` strategy for the Beta namespace to definitively prevent double-memory exhaustion in LXD.

## [0.6.4] - 2026-06-03

### Dependency Security Hardening & CSP Nonce Integration

This release implements server-side dynamic CSP nonces for Cloudflare Insights script validation and upgrades workspace dependencies to address security advisories, improve network resilience, and optimize client build/compilation speeds.

### 🔒 Security & CSP

- **Dynamic CSP Nonces:** Implemented cryptographically secure, per-request nonce generation middleware (`crypto`) and integrated it into the Content Security Policy (`helmet` configuration). This resolves script-blocking issues caused by Cloudflare Insights inline script injections without resorting to unsafe inline scripting.
- **Dependency Hardening:** Upgraded core production dependencies including `mongoose` (v9.6.3), `zod` (v4.4.3), and `express-rate-limit` (v8.5.2) to resolve transitive vulnerability reports and secure database/validation/rate-limiting pipelines.
- **Biometric Security:** Bumped `@simplewebauthn/server` and `@simplewebauthn/browser` versions to improve passwordless login stability.

### 🚀 Performance & Tooling Upgrades

- **Vite & Tooling Upgrades:** Upgraded Vite build tooling (`vite` v8.0.16) and `esbuild` (v0.28.0), reducing development startup and client build compilation times.
- **React & Routing:** Bumped `react` / `react-dom` to v19.2.7 and `react-router-dom` to v7.16.0 for better rendering efficiency and routing optimizations.
- **HTTP Client:** Upgraded `axios` to v1.17.0 for more stable networking across client and server.
- **Linter & Formatting:** Upgraded ESLint configurations to v10.4.1 to align linting capabilities.

## [0.6.3] - 2026-02-22

### Subscription & Auth Fix, Tier Theming, Pricing Redesign, and QR Worker

This release resolves a critical subscription display bug, adds dynamic tier theming, redesigns the pricing page, and improves QR code performance.

### 🐛 Critical Fixes

- **Subscription Tier Display:** Fixed initial login showing "Free" tier instead of the user's actual subscription; enriched login & register server responses with the full user object (subscription, clickUsage, avatar, snapId, eliteId, idTier, bio, etc.) to match `/auth/refresh`.
- **Stale Auth Cache:** Triggered background `checkAuth()` in AuthContext after login/register to immediately overwrite any stale localStorage cache with fresh server data — prevents the "show free → correct after tab change" race condition.
- **SPA Route 404s:** Fixed `/roadmap`, `/pricing`, and other client-side routes returning 404 by adding them to the exact-match skip list in `redirectRoutes.js`.

### ✨ Features & UI

- **Tier Theming System:** Added `tierTheme.js` with centralised colour tokens and `applyTierTheme()` — writes CSS custom properties onto `<html>` so all dashboard components inherit the active tier's theme automatically.
- **Upgrade Celebration:** DashboardLayout detects tier upgrades and triggers a brief glow animation on the sidebar user card.
- **Pricing Page Redesign:** Rebuilt Free, Pro, and Business tier cards with corrected yearly pricing for Business.
- **SubscriptionCard Redesign:** Tier-aware styling with dynamic colour tokens.
- **Overview Page Refactor:** Subscription usage section rebuilt with tier colour integration.
- **Admin Changelog Manager:** Added JSON import capability for bulk changelog entry management.
- **Public Changelog Page:** Updated with enhanced filtering and search across releases.

### 🚀 Performance

- **QR Code Web Worker:** Offloaded QR code generation to a dedicated Web Worker (`qrWorker.js`) for non-blocking rendering.
- **QR Export Utility:** Added `qrExport.js` for high-resolution PNG export from QR SVGs.
- **Virtual Scrolling for Links:** UserDashboard link list now uses `@tanstack/react-virtual` for smooth performance with large collections.

### 🔒 Security

- **Dependency hardening:** Removed unused direct `fstream` and `minimatch` deps. Upgraded `geoip-lite` to `1.4.10` — drops the vulnerable `unzip`/`fstream` transitive chain. Added `minimatch: "10.2.2"` overrides to both server and client — resolves Dependabot alerts [#17, #20, #21, #22] (ReDoS CVEs, Arbitrary File Overwrite in fstream).
- **Everything updated to latest:** All server and client packages bumped to their latest versions including ESLint 10, nodemon 3.1.14, `@simplewebauthn` 13.2.3, and all devDependencies. Zero vulnerabilities across both workspaces.

### 🛡️ Code Quality

- Fixed 3 `no-useless-assignment` errors surfaced by ESLint 10's new rule: `config/env.js` (fallback dotenv result), `subscriptionMiddleware.js` (redundant `needsReset` initializer), `useAppVersion.js` (redundant null-guard on ESM singleton fetch).
- Internal lint fixes and React hook dependency corrections.
- Expanded subscription service with additional tier helpers.
- Improvements to analytics, URL, and subscription controllers.

---

## [0.6.1] - 2026-02-14

### Docker CI/CD Automation & Security Update

This release automates the Docker build and push pipeline while hardening environment security and dependencies.

### 🐳 Docker CI/CD

- **Automated Pipeline:** Implemented GitHub Actions workflow for automated builds and pushes to Docker Hub.
- **Smart Tagging:** Added support for `latest`, SemVer, and Git commit SHA tagging.
- **Build Optimization:** Reduced Docker build context by ~99% using a comprehensive `.dockerignore`.
- **Reproducible Builds:** Pinned Docker images to `node:20-alpine` and fixed `VITE_*` build arguments for reliable production URL injection.

### 🛡️ Security & Scalability

- **Dependency Hardening:** Updated `mongoose` (9.2.0) and `qs` (6.14.2) to resolve Dependabot alerts.
- **Cleanup:** Removed orphaned `client/Dockerfile` and fixed `deploy.yml` string bugs.

---

## [0.6.0] - 2026-02-10

### Major Release: Performance & Security Overhaul

This release focuses on significant performance optimizations, advanced security features, and UI/UX improvements.

### 🚀 Performance & Optimization

- **Bundle Optimization:** Reduced CSS bundle by ~88% and JS bundle by ~70% via strict tree-shaking and code splitting.
- **Lazy Loading:** Implemented route-based and component-based lazy loading (Admin Dashboard, QR Codes, Landing Page).
- **PWA Enhanced:** Fixed manifest injection and improved offline caching strategies.
- **Compression:** Enabled Brotli & Gzip compression for all static assets.
- **SEO & Lighthouse:** Improved Core Web Vitals (LCP, CLS) and SEO meta tags structure.
- **DB Optimization:** Optimized Cosmos DB queries and indexing for faster data retrieval.

### 🛡️ Security v2

- **Safe Browsing Integration:** Real-time checking of destination URLs against threat databases.
- **Bot Protection:** Advanced bot detection (`botDetector.js`) and persistent bio-profile limiting.
- **Security Hardening:** Fully removed known security vulnerabilities (XSS, Regex Injection).
- **Strict Headers:** Implemented strict origin and CSP headers.

### ✨ Features & UI

- **Time/Device Routing:** Enhanced routing logic with improved UI for creation/editing.
- **UI Overhaul:** Standardized all modals with `dvh` support and better mobile gestures (Pull-to-Refresh).
- **Admin Dashboard:** New notification system and improved user management UI.
- **Enhanced Limits:** Updated tier limits for Bio Pages and Link creation.

### 🐛 Fixes

- Fixed time-zone handling in routing logic.
- Fixed 404 errors with PWA manifest in development.
- Resolved various mobile scrolling and modal interaction bugs.

---

## [0.5.6] - 2026-01-07

### Update for Session & Security Stability

Updated the codebase to fix critical security flaws and implement robust session management.

- ⬆️ **Improvement:** Session Management now handles with a more robust secure system (cookie-session).
- 🐛 **Fix:** Critical Dependency `ERR_MODULE_NOT_FOUND` fixed by migrating to `ua-parser-js`.
- 🐛 **Fix:** CSRF implementation fixed to support stateless login flows.
- 🔒 **Security:** Hardened GitHub Actions permissions and Enforced Branch Protection.

## [0.5.5] - 2025-01-07

### Security

- **Fixed 27 security vulnerabilities** identified by CodeQL:
  - 4 ReDoS (Regular Expression Denial of Service) vulnerabilities
  - 3 Regex injection vulnerabilities
  - 1 Missing CSRF protection (implemented double-submit cookie pattern using `lusca`)
  - 2 Incomplete sanitization issues
  - 9 NoSQL injection vulnerabilities (added allowlist validation)
  - 3 XSS/HTML injection vulnerabilities
  - 1 Incomplete URL scheme check (added data: and vbscript: filtering)
  - 1 Clear-text storage of password & sensitive logic in localStorage
  - 1 Clear-text logging of password
  - 1 Incomplete string escaping (escaped backslashes in JS contexts)

### Added

- Professional GitHub documentation suite (README, CONTRIBUTING, SECURITY)
- Pull Request and Issue templates
- Dependabot configuration for automated dependency updates
- Automated Linting workflow (Client & Server)
- Environment variable documentation (.env.example)

### Changed

- Improved Settings page mobile UX with scroll indicators
- Enhanced scroll arrows visibility for settings tabs

### Fixed

- React Hook order violation in SettingsPage
- Bio Settings page tier logic mismatch
- Console log cleanup for production builds

---

## [0.5.0] - 2025-01

### Added

- **Link-in-Bio Page** - Create personalized bio pages with multiple links, custom themes, and branding
- **Device-Based Redirects** - Route visitors to different URLs based on device (iOS/Android/Desktop)
- **Subscription System** - Tiered access (Free/Pro) with Lemon Squeezy payment integration
- **Ban & Appeal System** - Account suspension with structured appeal workflow
- **Biometric Authentication** - WebAuthn/FIDO2 device authentication for admin access

### Changed

- Improved modal positioning for mobile devices with safe-area-inset support
- Global Pull-to-Refresh for PWA users

---

## [0.4.0] - 2024-12

### Added

- **Password-Protected Links** - Require password before redirecting
- **Link Expiration** - Auto-expire links after specified duration
- **Custom Aliases** - Memorable short URLs like `/my-brand`
- **QR Code Generation** - High-resolution QR codes for every link
- **Real-Time Analytics** - Click tracking with geographic and device data
- **Session Management** - Secure HttpOnly cookies with token rotation

### Fixed

- Mobile modal UI glitches with scroll lock implementation

---

## [0.3.0] - 2024-11

### Added

- **PWA Support** - Progressive Web App with offline access
- **Offline Mode Indicator** - Hybrid grayscale overlay with status pill
- **API Error Handling** - Centralized `handleApiError` utility
- **Audit Logs** - Login history, ban history, and appeal logs

### Changed

- Link title auto-fetch from URL metadata

---

## [0.2.0] - 2024-10

### Added

- **Admin Panel** - User management with promote/demote capabilities
- **Create Users** - Admin can create new users directly
- **Copy Link** - One-click clipboard functionality
- **Beautiful Inactive Link Page** - Styled page for expired/disabled links

---

## [0.1.0] - 2024-09

### Added

- Initial release
- Basic URL shortening functionality
- User authentication (register/login)
- Dashboard with link management
- Click analytics per link

---

> **Note**: For the most up-to-date changelog, visit the [Changelog page](https://${VITE_DOMAIN}/changelog) in the app.
