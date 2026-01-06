# Changelog

All notable changes to Link-Snap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.5.5] - 2025-01-06

### Added
- Professional GitHub documentation suite (README, CONTRIBUTING, SECURITY)
- Pull Request and Issue templates
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

> **Note**: For the most up-to-date changelog, visit the [Changelog page](https://linksnap.centralindia.cloudapp.azure.com/changelog) in the app.
