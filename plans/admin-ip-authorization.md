# Admin Dynamic IP Authorization - Implementation Plan

> ⚠️ **NEW admin panel only. Avoid old admin panel.**

---

## Overview

Enable admin access from dynamic IPs using token-based authorization via `/login?token=XXX`.

---

## Phase 1: Core MVP

### Files
| File | Action |
|------|--------|
| `server/models/AdminAuthorizedIP.js` | NEW |
| `server/middleware/ipWhitelist.js` | MODIFY |
| `server/controllers/authController.js` | MODIFY |
| `client/src/pages/AdminAuthPage.jsx` | NEW |

### Features
- `/admin-auth` token entry page
- Token via `/login?token=XXX`
- Store IPs in DB with expiry
- Duration: 24h, custom days (12AM IST), never

### Edge Cases & Bugs
| Issue | Solution |
|-------|----------|
| Token in browser history | Redirect to clean URL after auth |
| Token in server logs | Strip from request logs |
| IPv6 `::ffff:` prefix | Normalize before comparison |
| Empty/whitespace token | Trim and validate |
| Non-admin with valid token | Reject - only admins get IP auth |
| Token case sensitivity | Case-insensitive comparison |
| Multiple admins same IP | Allow - track authorizing user |
| Expired IP in DB | TTL index auto-delete |

### PWA Considerations
| Issue | Solution |
|-------|----------|
| Can't add query params | Use `/admin-auth` page |
| Cached 404 response | Clear SW cache on auth |
| Offline open | Queue auth, execute when online |
| App backgrounded | Re-validate IP on foreground |

### Impact Check
- [ ] Auth flow: Add token handling
- [ ] Rate limiter: Limit token attempts (5/min)
- [ ] PWA SW: May cache 404 for admin routes

---

## Phase 2: Admin Settings UI

### Files
| File | Action |
|------|--------|
| `client/src/pages/admin-console/IPManagement.jsx` | NEW |

### Features
- View authorized IPs (with revoke)
- Device naming ("iPhone - Home")
- Remember token in PWA localStorage

### Coming Soon UI (No Backend)
- 📧 Email notifications toggle
- 🌍 IP geo display (city/country)
- 📱 Token via SMS
- 🔢 Session limit slider
- 📋 IP history log table

### Edge Cases
| Issue | Solution |
|-------|----------|
| Admin demoted to user | Revoke their authorized IPs |
| Device name too long | Max 50 chars |
| Duplicate IP entry | Update existing, don't create new |

### Impact Check
- [ ] Admin nav: Add menu item
- [ ] Admin routes: Register new route

---

## Phase 3: Admin Login Design

### Files
| File | Action |
|------|--------|
| `client/src/layouts/AdminLayout.jsx` | MODIFY |

### Features
- Shield icon branding
- Glassmorphism card
- Security indicators
- Error animations

### Edge Cases
| Issue | Solution |
|-------|----------|
| Theme inconsistency | Use existing color tokens |
| Mobile overflow | Responsive constraints |

### Impact Check
- [ ] Theme system: Consistent colors
- [ ] Mobile layout: Test small screens

---

## Phase 4: PWA Enhancements

### Features
- Remember device (encrypted localStorage)
- Auto-auth on IP change when saved token exists
- Offline queue for auth requests

### Edge Cases
| Issue | Solution |
|-------|----------|
| Token stolen from localStorage | Encrypt with device fingerprint |
| Shared device | Clear token on logout |
| Multiple PWA instances | Sync via localStorage events |

### Impact Check
- [ ] Service worker: Update cache strategy
- [ ] Offline page: Handle auth state

---

## Security Considerations

| Risk | Mitigation |
|------|------------|
| Token brute-force | Rate limit: 5 attempts/min |
| Token leak | Min 8 chars, rotate monthly |
| MITM attack | HTTPS only |
| Stolen device | Remote revoke from admin panel |
| Shoulder surfing | Mask token in URL bar quickly |
| Token in clipboard | Auto-clear after 30s |
| Mobile carrier NAT | Warn user about shared IPs |

---

## Future Improvements

| Feature | Benefit |
|---------|---------|
| One-time use tokens | Extra security |
| Biometric + token | FaceID/fingerprint |
| Trusted networks | Auto-auth on home WiFi |
| QR code generator | Easy mobile auth |
| Emergency revoke all | Panic button |
| IP geo display | Visual verification |
| Telegram notifications | Real-time alerts |

---

## Env Variables

```bash
ADMIN_AUTH_TOKEN=ABC123
ADMIN_IP_AUTH_DURATION=24h  # Options: 24h, 7d, 30d, never
ADMIN_IP_AUTH_CUSTOM_DAYS=3 # For custom duration
```

---

## Final Checklist

After all phases:
- [ ] Login flow unchanged for normal users
- [ ] Session management works
- [ ] Rate limiting active
- [ ] Error handling consistent
- [ ] Mobile responsive
- [ ] PWA functional
- [ ] Documentation complete
