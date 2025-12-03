# Link Snap - Project Master Plan

## 1. Architecture Strategy: Production-Ready & Scalable

**Goal:** Build a robust, industry-standard URL shortener using a Client-Server architecture.

### Tech Stack

- **Frontend:** React (Vite), Tailwind CSS, Recharts, Axios, React Router DOM.
- **Backend:** Node.js, Express (ES Modules), Mongoose.
- **Database:** MongoDB Atlas (Cloud).
- **Authentication:** JWT (JSON Web Tokens) with HttpOnly cookies (optional) or LocalStorage.
- **Security:** Helmet (headers), CORS, Express Rate Limit, Bcrypt (password hashing).

### Core Concepts

- **Separation of Concerns:** Distinct `client` and `server` directories.
- **ES Modules:** Using `import/export` syntax in Node.js for consistency with frontend.
- **Validation:** Strict input validation for URLs and User data.

---

## 2. UI/UX Strategy: SaaS Architecture

**Goal:** A multi-user platform with clear role separation.

### Zones

1.  **Public Zone (The Hook):**
    - **Landing Page:** Minimalist, high-performance. Allows anonymous link shortening (limited features).
    - **Auth Pages:** Login and Register pages.
2.  **User Dashboard (The Retention):**
    - **My Links:** A table view of all links created by the user.
    - **Analytics Detail:** A dedicated page for a specific link showing charts and logs.
    - **Profile:** Basic settings.
3.  **Admin Console (The Control):**
    - **Global Stats:** Total users, total active links, system health.
    - **User Management:** Ability to view, ban, or delete users.

### User Experience

- **Feedback:** Use `react-hot-toast` for success/error notifications.
- **Visuals:** Dark mode by default. Clean lines.
- **Navigation:** Sidebar for Dashboards, Topbar for Public pages.

---

## 3. Step-by-Step Implementation Plan

### Phase 1: The Foundation (Backend Core)

_We start here so the Frontend has an API to talk to._

1.  **Project Scaffold**: Create `server` and `client` directories. Initialize `package.json` in both.
2.  **Database Connection**: Create `server/config/db.js` to connect to MongoDB Atlas.
3.  **User Model & Auth**:
    - Create `models/User.js` (email, password, role: 'user'|'admin').
    - Create `controllers/authController.js` (register, login, generate JWT).
    - Create `middleware/authMiddleware.js` (verify JWT token).
4.  **URL Model**: Create `models/Url.js`. Key fields: `originalUrl`, `shortId`, `clicks`, `visitHistory`, and `createdBy` (ObjectId ref to User).

### Phase 2: The Public Interface (Frontend Basics)

_Get the app running and visible._ 5. **Frontend Setup**: Initialize Vite + React. Install Tailwind CSS, `react-router-dom`, `axios`, and `react-hot-toast`. 6. **Router & Layouts**:
_ Create `layouts/PublicLayout.jsx` (Navbar with Login/Signup links).
_ Create `layouts/DashboardLayout.jsx` (Sidebar + Topbar for logged-in users). 7. **Auth Pages**:
_ Create `pages/Login.jsx` and `pages/Register.jsx`.
_ Implement the API calls to store the JWT.

### Phase 3: Core Feature - Shortening (The "Hook")

_Allow users to actually use the tool._ 8. **Backend Shorten Route**: Implement `POST /api/url/shorten`.
_ Logic: If user is logged in, attach their ID. If not, mark as "anonymous". 9. **Landing Page Component**:
_ Create `components/UrlInput.jsx`: A big, beautiful input field.
_ Create `components/ResultCard.jsx`: Displays the short link, Copy button, and QR Code.
_ Assemble these into `pages/LandingPage.jsx`.

### Phase 4: The User Dashboard (The "Retention")

_Where users manage their data._ 10. **Backend List Route**: Implement `GET /api/url/my-links` (fetches URLs where `createdBy == currentUser`). 11. **Dashboard Components**:
_ Create `components/LinkTable.jsx`: A list showing Original URL, Short URL, and Total Clicks.
_ Create `pages/UserDashboard.jsx`: Wraps the table and handles data fetching.

### Phase 5: Analytics & Visualization (The "Flex")

_The complex data visualization part._ 12. **Backend Analytics Route**: Implement `GET /api/url/analytics/:id`.
_ Should return detailed `visitHistory` (timestamps, device type, IP location). 13. **Analytics Components**:
_ Create `components/StatsCard.jsx`: Simple boxes for "Total Clicks", "Last 24h".
_ Create `components/ClickChart.jsx`: Use `recharts` to show a line graph of clicks over time.
_ Create `pages/AnalyticsPage.jsx`: The detail view when a user clicks a link in their dashboard.

### Phase 6: The Master Admin (The Control)

_System management._ 14. **Backend Admin Middleware**: Update `authMiddleware.js` to check `if (user.role === 'admin')`. 15. **Admin Routes**:
_ `GET /api/admin/stats`: Global counts (Total Users, Total URLs).
_ `GET /api/admin/users`: List all users. 16. **Admin UI**:
_ Create `pages/AdminDashboard.jsx`.
_ Reuse `StatsCard` for global stats. \* Create a `UserManagementTable` component.

### Phase 7: The Redirector (The Engine)

_The final piece that makes the links work._ 17. **Redirect Route**: Implement `GET /:shortId` in the backend. \* Find URL -> Push Timestamp/UserAgent to `visitHistory` -> `res.redirect(originalUrl)`.
