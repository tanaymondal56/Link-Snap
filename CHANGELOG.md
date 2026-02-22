# Changelog

All notable changes to Link-Snap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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

### 🛡️ Code Quality & Lint
- Removed unused `tierLabel` in `subscriptionMiddleware.js`.
- Wrapped `fetchProfile` in `useCallback` with correct dependency array in `SettingsPage.jsx`.
- Various improvements to analytics, URL, and subscription controllers.
- Expanded `subscriptionService.js` with additional tier helpers.

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
