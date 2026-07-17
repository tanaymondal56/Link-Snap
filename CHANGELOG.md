# Changelog

All notable changes to Link-Snap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.7.1] - 2026-07-17

### Redis Cache Offloading, Custom Bloom Filters & Core Performance Overhaul

This release implements high-performance Redis cache-aside patterns, introduces a custom Redis Bloom filter engine optimized for Upstash, overhauls Razorpay to support recurring billing with fallback safety, adds one-time monthly purchase tiers, and hardens the daily database subscription expiry checks.

### 💳 Razorpay & Lemon Squeezy Billing Engine Overhaul
- **Razorpay Subscriptions (Recurring):** Integrated the Razorpay Subscriptions API (`razorpay.subscriptions.create`) to establish true recurring billing cycles for monthly and yearly tiers.
- **Verification Signature Engine:** Created dual signature validators (Order Hashing vs. Subscription Hashing) for secure, timing-safe webhook processing.
- **Fail-safe Fallback:** Engineered a fallback layer where missing environment configuration Plan IDs automatically convert checkouts to standard Orders, preventing client-side blocker errors.
- **One-Time Monthly Billing:** Introduced a "1 Month (One-time)" billing toggle. Integrated Lemon Squeezy `order_created` and `order_refunded` events to support one-off USD checkouts with calendar-correct 1-month expirations.
- **Modal Dismiss Recovery:** Resolved a frontend lockup where closing the Razorpay checkout modal left the pricing page frozen; modal closing now cleanly resets the checkout state.

### 🧹 Hardened Enterprise Subscription Expiry Sweeper
- **Race Condition Prevention:** Refactored the sweeper script from raw `updateMany` updates to sequentially fetch and `.save()` users. This activates Mongoose's Optimistic Concurrency Control (`__v`), stopping the sweeper from overwriting fresh payments processed by webhooks concurrently.
- **Audit Trails:** Set up automated generation of compliance history records in `SubscriptionAuditLog` for every automated downgrade performed by the daily sweep.

### 🧠 Custom Redis Bloom Filter Engine (Module-less Upstash Optimization)
- **High-Speed Bitwise Filters:** Built using standard Redis `SETBIT` / `GETBIT` to bypass the need for native `RedisBloom` modules on Upstash.
- **Dynamic Case-Sensitivity & Shielding:** Optimized username lookups (case-insensitive) and short URL redirects (case-sensitive) to block invalid DB lookups early.
- **Concurrency Controls:** Gated seeding on startup with a distributed lock and implemented zero-downtime swaps using Redis `RENAME`.

### 🚀 High-Impact Redis Caching & Performance Optimizations
- **API Offloading:** Cached link analytics (subscription-tier keyed, compressed over 50KB), lander roads/logs, notification counters, and admin stats.
- **Active Invalidation & DB Parallelism:** Integrated immediate bio cache invalidations and replaced serial MongoDB lookups with parallel queries.
- **Session & Auth Cache:** Optimized JWT auth middleware by caching hydrated user documents and shifted active verification OTP codes to Redis-first storage.
- **N+1 Query & Cron Fixes:** Resolved sequential click queries with batch maps, added distributed locks for background cron flushes in PM2 cluster mode, and added a custom scan wrapper for Upstash REST compatibility.

### 🛡️ Auth Security & UX Hardening
- **OTP Hardening:** Implemented cryptographically secure `crypto.randomInt` OTPs, SHA256 hashed password reset tokens, and a 3-attempt limit that instantly deletes OTP cache on violation.
- **UI/UX Updates:** Added interactive password complexity validation on registration, "Paste Code" clipboard integration, autofill disabling on verification fields, and spam warning highlights.
- **Infrastructure:** Upgraded to Redis 8, added container image prunes after deployment rollouts, and optimized lint checks on workflows.

### 🛡️ Remediation Hardening & Security Fixes
- **Safe Browsing Hash Keys:** Hardened Safe Browsing cache security by replacing 30-byte URL truncation with SHA-256 keys, eliminating cache collision bypass vectors.
- **Alias Hijacking prevention:** Removed case-insensitive DB fallbacks in `redirectController.js` to align DB lookups with the case-sensitive Bloom Filter, preventing case-squatting alias exploits.
- **Click Usage Lock-In:** Shifted click-tracking middleware to atomic Redis `INCR` commands to solve concurrent click usage lost-update conditions.
- **Client-Side Validation Checks:** Implemented strict manual date validation checks in `CreateLinkModal`/`EditLinkModal` to block mobile users from scheduling past expiration dates.
- **Cross-Tab Authentication Sync:** Added a `storage` listener in `AuthContext` to immediately synchronize logout events across multiple open tabs.

### ⚙️ Container & K8s Infrastructure Hardening
- **Docker Rootless Hardening:** Configured frontend Nginx deployment configurations to execute on port `8080`, preventing Permission Denied crashes under rootless environments.
- **OOM Prevention limits:** Passed `--max-old-space-size=400` to Node.js V8 execution inside the server Dockerfile, preventing memory leaks from causing cluster OOMKills.
- **Rollout Sync (CronJobs):** Automated pipeline releases to simultaneously roll out new image tags to both the core backend deployment and `ban-scheduler` / `safe-browsing` CronJobs.
- **PWA & Nginx SPA Routes:** Fixed PWA routing failures by excluding SPA routes from the cache-first denylist regex, and added missing redirection routes (`/u` and easter eggs) to the Nginx fallback route file.
- **UI Performance Rendering:** Optimized search query execution in `UserDashboard.jsx` using `useMemo` for client-side filtering.

---

## [0.7.0] - 2026-07-14

### Major Overhaul: Security, Independent Deployments & Cloudflare Integration

> [!WARNING]
> **Versioning Correction & Apology:**
> We sincerely apologize for a versioning blunder where this release was accidentally published as version `7.0.0`. 
> To restore standard Semantic Versioning, the repository has been updated to use the `0.7.x` schema going forward.
> Please note that **the `0.7.0` version tag is NOT available as a Docker image**(You can refer exact commit tag as a image). If you need to reference the exact release commit, please check the corresponding GitHub release tags.

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
