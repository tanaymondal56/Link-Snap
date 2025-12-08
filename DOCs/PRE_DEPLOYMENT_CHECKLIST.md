# Link Snap - Pre-Deployment Checklist

A comprehensive checklist of all tasks required before deploying Link Snap to production.

---

## 1. Environment Variables

### Server Environment Variables

Set these in your deployment platform's environment settings:

| Variable             | Required | Description                                             | Status |
| :------------------- | :------- | :------------------------------------------------------ | :----- |
| `NODE_ENV`           | ✅       | Set to `production`                                     | ⬜     |
| `PORT`               | ✅       | Server port (usually `8000` or platform default)        | ⬜     |
| `MONGO_URI`          | ✅       | MongoDB Atlas connection string                         | ⬜     |
| `USE_LOCAL_DB`       | ✅       | Set to `false` for production                           | ⬜     |
| `JWT_ACCESS_SECRET`  | ✅       | 64+ character random secret                             | ⬜     |
| `JWT_REFRESH_SECRET` | ✅       | Different 64+ character random secret                   | ⬜     |
| `CLIENT_URL`         | ✅       | Your production domain (e.g., `https://yourdomain.com`) | ⬜     |
| `COOKIE_SAMESITE`    | ⚪       | `strict` (default) or `lax` for tunnels                 | ✅     |
| `ENCRYPTION_KEY`     | ✅       | Exactly 32 character key for email encryption           | ⬜     |

**Generate secure secrets:**

```bash
# Run twice to get two different secrets
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

---

## 2. Domain & URLs to Update

Replace `https://linksnap.app/` with your actual production domain:

| File                        | URLs to Update                                        | Status |
| :-------------------------- | :---------------------------------------------------- | :----- |
| `client/index.html`         | `og:url`, `twitter:url`, `canonical`, `og:image` (5x) | ⬜     |
| `client/index.html`         | `twitter:creator` - change `@linksnap` to your handle | ⬜     |
| `client/public/sitemap.xml` | All `<loc>` URLs (3 total)                            | ⬜     |
| `client/public/robots.txt`  | Sitemap URL                                           | ⬜     |

### Hardcoded Emails to Update

| File                                    | Line | Email                  | Action                                                   |
| :-------------------------------------- | :--- | :--------------------- | :------------------------------------------------------- |
| `server/controllers/authController.js`  | 202  | `support@linksnap.com` | Change to your support email                             |
| `client/src/pages/AccountSuspended.jsx` | 199  | Fallback support email | Uses `SUPPORT_EMAIL` env but has `linksnap.com` fallback |

### Hardcoded IPs to Update

| File                               | Line | IP                | Action                      |
| :--------------------------------- | :--- | :---------------- | :-------------------------- |
| `server/middleware/ipWhitelist.js` | 9    | `100.100.100.169` | Change to your admin/dev IP |
| `server/middleware/rateLimiter.js` | 12   | `100.100.100.169` | Change to your admin/dev IP |

> **Note**: Server-side URLs use `CLIENT_URL` env variable automatically ✅

---

## 3. Assets Checklist

All required assets in `client/public/`:

| File                   | Size     | Purpose                | Status |
| :--------------------- | :------- | :--------------------- | :----- |
| `favicon.svg`          | Vector   | Browser tab icon       | ✅     |
| `favicon-32x32.png`    | 32x32    | Fallback favicon       | ✅     |
| `favicon-16x16.png`    | 16x16    | Small favicon          | ✅     |
| `apple-touch-icon.png` | 180x180  | iOS home screen        | ✅     |
| `pwa-192x192.png`      | 192x192  | PWA icon (Android)     | ✅     |
| `pwa-512x512.png`      | 512x512  | PWA splash screen      | ✅     |
| `og-image.png`         | 1200x630 | Social sharing preview | ⬜     |
| `browserconfig.xml`    | -        | Windows tile config    | ✅     |
| `robots.txt`           | -        | Search engine rules    | ✅     |
| `sitemap.xml`          | -        | SEO sitemap            | ✅     |

> **Tool**: Use [RealFaviconGenerator.net](https://realfavicongenerator.net/) to generate all icons from one image.

---

## 4. Security Hardening

| Task                                 | Location             | Status |
| :----------------------------------- | :------------------- | :----- |
| Remove dev tools in production build | `vite.config.js`     | ⬜     |
| Secure cookies configured            | `authController.js`  | ✅     |
| Rate limiting active                 | `rateLimiter.js`     | ✅     |
| Helmet security headers              | `server/index.js`    | ✅     |
| CORS configured                      | `server/index.js`    | ✅     |
| NoSQL injection protection           | `sanitizer.js`       | ✅     |
| Remove debug console.logs            | See list below       | ⬜     |
| Set ENCRYPTION_KEY env variable      | Prevents default key | ⬜     |

### Console.logs to Remove/Keep

**Remove before production:**

- `server/index.js` line 153 (SPA catch-all log)
- `server/controllers/redirectController.js` lines 926, 960, 964 (debug logs)
- `server/middleware/ipWhitelist.js` line 65 (IP allowed log)
- `server/middleware/verifyAdmin.js` line 8 (admin verify log)

**Keep (utility scripts, only run manually):**

- `server/scripts/registerUser.js` (CLI script)
- `server/scripts/makeAdmin.js` (CLI script)
- `server/controllers/adminController.js` line 34 (email config warning)

---

## 5. Vite Config - Production Optimization

Remove development-only plugins for production build:

```javascript
// vite.config.js - Remove or conditionally load these:
import Inspector from 'vite-plugin-react-inspector'; // ❌ Remove
import VitePluginDevTools from 'vite-plugin-devtools'; // ❌ Remove
```

**Recommended approach:**

```javascript
const isDev = process.env.NODE_ENV === 'development';

plugins: [
  react(),
  ...(isDev ? [Inspector(), VitePluginDevTools({})] : []),
  // ... other plugins
];
```

### Security Note: Encryption Key

The file `server/models/Settings.js` has a fallback default encryption key:

```javascript
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-char-encryption-key!';
```

**⚠️ CRITICAL**: Always set the `ENCRYPTION_KEY` environment variable in production!
If not set, the default key is used, making email passwords vulnerable.

---

## 6. Build & Deploy Commands

### Local Build Test

```bash
# Install all dependencies
npm run install:all

# Build client
cd client && npm run build

# Test production server locally
cd ../server
NODE_ENV=production node index.js
```

### Deployment (Platform-Agnostic)

| Setting           | Value                                               |
| :---------------- | :-------------------------------------------------- |
| **Build Command** | `npm run build` (or `npm install && npm run build`) |
| **Start Command** | `npm start`                                         |
| **Port**          | Use `PORT` env variable (default: 8000)             |
| **Node Version**  | 18.x or 20.x                                        |

---

## 7. Database Preparation

| Task                 | Command/Action                                   | Status |
| :------------------- | :----------------------------------------------- | :----- |
| MongoDB Atlas setup  | Create cluster at mongodb.com                    | ⬜     |
| Whitelist IPs        | Add `0.0.0.0/0` or specific IPs in Atlas         | ⬜     |
| Create database user | Strong password, readWrite permissions           | ⬜     |
| Create admin user    | `node scripts/makeAdmin.js admin@yourdomain.com` | ⬜     |
| Enable backups       | Set up Atlas automated backups                   | ⬜     |

---

## 8. Post-Deployment Verification

| Check                    | How to Test                       | Status |
| :----------------------- | :-------------------------------- | :----- |
| Homepage loads           | Visit your domain                 | ⬜     |
| HTTPS working            | Check for padlock icon            | ⬜     |
| Registration works       | Create a new account              | ⬜     |
| Email verification sends | Check inbox (if email configured) | ⬜     |
| Login works              | Log in with the new account       | ⬜     |
| Link creation works      | Shorten a URL                     | ⬜     |
| Redirect works           | Click the short link              | ⬜     |
| Analytics tracking       | Check dashboard after redirect    | ⬜     |
| Admin panel accessible   | Login as admin, go to `/admin`    | ⬜     |
| PWA installable          | Check for install prompt          | ⬜     |
| Mobile responsive        | Test on phone or DevTools         | ⬜     |

---

## 9. Files Structure for Deployment

```
Link-Snap/
├── package.json          # Root package with build/start scripts ✅
├── Procfile              # Process file for some platforms ✅
├── .nvmrc                # Node version specification ✅
├── .env.example          # Environment variable template ✅
├── client/
│   ├── package.json
│   ├── dist/             # Built at deploy time (not committed)
│   └── public/           # Static assets ✅
└── server/
    ├── package.json
    └── index.js          # Entry point
```

---

## 10. Files to NOT Deploy

Ensure these are in `.gitignore`:

```gitignore
.env                 # ✅ In .gitignore
node_modules/        # ✅ In .gitignore
client/dist/         # ✅ In .gitignore (built during deploy)
*.log                # ✅ In .gitignore
.DS_Store            # ✅ In .gitignore
```

---

## 11. Optional Enhancements

| Enhancement                             | Priority | Status |
| :-------------------------------------- | :------- | :----- |
| Create `og-image.png` (1200x630)        | High     | ⬜     |
| Submit sitemap to Google Search Console | High     | ⬜     |
| Set up error monitoring (Sentry)        | High     | ⬜     |
| Configure CDN (Cloudflare)              | Medium   | ⬜     |
| Set up uptime monitoring (UptimeRobot)  | Medium   | ⬜     |
| Google Analytics                        | Low      | ⬜     |

---

## 12. Architecture Notes

### In-Memory Cache (cacheService.js)

The app uses an in-memory LRU cache for URL redirects:

- **Location**: `server/services/cacheService.js`
- **Behavior**: Cache is **lost on server restart** and **not shared** between instances
- **Impact**: First request after restart will hit the database
- **Action**: This is acceptable for single-instance deployments (Koyeb, Railway, Render)

### Ban Scheduler (banScheduler.js)

The app runs a background job to process expired bans:

- **Location**: `server/services/banScheduler.js`
- **Behavior**: Uses `setInterval` every 60 seconds
- **Impact**: **NOT compatible with serverless** (Vercel, AWS Lambda, Cloudflare Workers)
- **Action**: Deploy to container/VM platforms only (Koyeb, Railway, Render, VPS)

### Missing but Recommended (Future Improvements)

| Feature                     | Status | Notes                                                           |
| :-------------------------- | :----- | :-------------------------------------------------------------- |
| Unhandled rejection handler | ⬜     | Add `process.on('unhandledRejection')` for production stability |
| Compression middleware      | ⬜     | Add `compression` package for gzip/brotli responses             |
| Graceful shutdown           | ⬜     | Handle `SIGTERM` to close DB connections gracefully             |

---

## Quick Summary

### ✅ Already Done

- [x] PWA manifest & icons configured
- [x] Security middleware (Helmet, CORS, rate limiting)
- [x] Cookie security settings
- [x] Deployment scripts in package.json
- [x] .gitignore properly configured
- [x] robots.txt & sitemap.xml created
- [x] Favicon & PWA icons in place
- [x] Hardcoded IPs replaced with placeholder examples
- [x] Hardcoded emails use env variables with safe fallbacks
- [x] Domain URLs use `your-domain.com` placeholder

### ⬜ Still Needed

- [ ] Create `og-image.png` for social sharing (optional for test)
- [ ] Remove dev plugins from vite.config.js (or make conditional)
- [ ] Remove debug console.logs from server (optional for test)
- [ ] Set all environment variables on Koyeb
- [ ] Create MongoDB Atlas database
- [ ] Create admin user after deployment
- [ ] Test all features post-deployment

---

_Last Updated: December 4, 2025_
