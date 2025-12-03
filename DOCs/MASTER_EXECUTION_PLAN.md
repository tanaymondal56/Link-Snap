# Link Snap - Master Execution Roadmap

This document synthesizes all previous planning files into a single, linear execution path. Follow this guide to build the application from scratch to production-ready status.

---

## Phase 0: Initialization & Infrastructure

**Goal:** Set up the workspace, version control, and basic environments.

1.  **Directory Structure**:
    - Create root folder `link-snap`.
    - Create `server` (Node.js) and `client` (React) subdirectories.
2.  **Git Setup**: Initialize git repository and create `.gitignore` (node_modules, .env).
3.  **Backend Init**:
    - Run `npm init -y` in `server`.
    - Set `"type": "module"` in `package.json`.
    - Create `server/.env` with placeholders (MONGO_URI, JWT_SECRET, CLIENT_URL).
4.  **Frontend Init**:
    - Run `npm create vite@latest .` in `client`.
    - Install Tailwind CSS and configure `tailwind.config.js`.

---

## Phase 1: Backend Core (The Engine)

**Goal:** A secure API capable of Authentication and Database operations.

1.  **Dependencies**: Install `express`, `mongoose`, `dotenv`, `cors`, `helmet`, `cookie-parser`, `zod`, `bcrypt`, `jsonwebtoken`, `express-rate-limit`.
2.  **Database**:
    - Create `server/config/db.js`: Robust MongoDB Atlas connection with error listeners.
3.  **Security & Utilities**:
    - Create `server/utils/logger.js` (Winston).
    - Create `server/middleware/errorHandler.js` (Centralized error handling).
4.  **Authentication Module**:
    - **Model**: `models/User.js` (email, password, role, refreshTokens).
    - **Validation**: `validators/authValidator.js` (Zod schemas).
    - **Controller**: `controllers/authController.js` (Register, Login, Refresh, Logout).
      - _Implementation_: Use "Double Token" strategy (HttpOnly Cookies).
    - **Middleware**: `middleware/authMiddleware.js` (verifyAccessToken, verifyAdmin).
5.  **Routes**: Setup `routes/authRoutes.js` and mount in `app.js`.

---

## Phase 2: Frontend Foundation (The Shell)

**Goal:** A responsive UI with working Authentication.

1.  **Dependencies**: Install `axios`, `react-router-dom`, `react-hot-toast`, `lucide-react`, `clsx`, `tailwind-merge`.
2.  **Architecture**:
    - Setup `src/api/axios.js`: Configure interceptors to handle 401 errors and auto-refresh tokens.
    - Setup `src/context/AuthContext.jsx`: Global state for User and Loading status.
3.  **Routing & Layouts**:
    - `layouts/PublicLayout.jsx`: Navbar + Footer.
    - `layouts/DashboardLayout.jsx`: Sidebar + Topbar + Protected Route wrapper.
4.  **Auth Pages**:
    - Build `pages/Login.jsx` and `pages/Register.jsx`.
    - Connect forms to Backend API.

---

## Phase 3: The "Link Snap" Core Features

**Goal:** Users can create links, and the system redirects traffic.

1.  **Backend - URL Module**:
    - **Model**: `models/Url.js` (shortId, originalUrl, createdBy, isActive).
      - _Index_: Unique index on `shortId`.
    - **Controller**: `controllers/urlController.js`.
      - `createShortUrl`: Generate NanoID, save to DB.
      - `getMyLinks`: Fetch user's links (paginated).
    - **Routes**: `routes/urlRoutes.js`.
2.  **Frontend - Creation & Management**:
    - **Landing Page**: `pages/LandingPage.jsx` (Public input, QR Code display).
    - **Dashboard**: `pages/UserDashboard.jsx`.
      - `components/CreateLinkModal.jsx`: Advanced options (Custom alias).
      - `components/LinkTable.jsx`: List view with Copy/Edit/Delete actions.
3.  **The Redirect Engine**:
    - Create `controllers/redirectController.js`.
    - _Logic_: Find URL -> Check Active -> **Async** push to Analytics Queue -> Redirect.

---

## Phase 4: Data & Control (Analytics & Admin)

**Goal:** Visual insights and system management.

1.  **Backend - Analytics**:
    - **Model**: `models/Analytics.js` (urlId, timestamp, ip, userAgent, location).
    - **Service**: `services/analyticsService.js` (Parse UA, GeoIP lookup).
    - **Controller**: `getAnalytics`: Aggregation pipeline (Group by Day, Device, Country).
2.  **Frontend - Visualization**:
    - Install `recharts`.
    - Build `pages/AnalyticsPage.jsx`.
    - Components: `ClickChart.jsx` (Line), `DeviceDonut.jsx`, `LocationMap.jsx`.
3.  **Backend - Admin**:
    - **Middleware**: Ensure `verifyAdmin` is strict.
    - **Controller**: `adminController.js` (getAllUsers, banUser, getSystemStats).
4.  **Frontend - Admin Panel**:
    - `layouts/AdminLayout.jsx` (Distinct theme).
    - `pages/AdminDashboard.jsx`: User Table with Ban/Delete buttons.

---

## Phase 5: Production Hardening & Optimization

**Goal:** Prepare for the real world.

1.  **Security Polish**:
    - Configure `helmet` CSP.
    - Enable `express-rate-limit` on Auth and Shorten routes.
    - Sanitize inputs against NoSQL injection.
2.  **Performance**:
    - Implement Redis caching for Redirects (if Redis is available).
    - Add Frontend Code Splitting (`React.lazy`).
3.  **DevOps**:
    - Create `Dockerfile` and `docker-compose.yml`.
    - Create `VERCEL.json` (if deploying frontend there).

---

## Phase 6: Future Proofing

**Goal:** Extract the template.

1.  **Refactor**: Ensure no hardcoded strings ("Link Snap") in core components.
2.  **Documentation**: Write `README.md` with setup instructions.
