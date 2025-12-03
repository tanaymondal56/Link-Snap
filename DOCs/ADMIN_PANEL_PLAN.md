# Link Snap - Master Admin Panel Strategy

## 1. Philosophy: "God Mode"

The Admin Panel is the control center for the entire application. It must provide **complete visibility** into system usage and **absolute control** over users and content. The UI should be dense, data-heavy, and efficient—designed for power users, not casual browsers.

---

## 2. Feature List (The "Feature Rich" Scope)

### A. The Command Center (Dashboard)

- **Real-Time KPI Cards:**
  - **Total Users:** Active vs. Banned.
  - **Total Links:** Active vs. Disabled.
  - **Total Clicks:** Today / This Week / All Time.
  - **System Health:** Database Latency (ms), API Status.
- **Growth Charts:**
  - User Registration Rate (Line Chart).
  - Link Creation Volume (Bar Chart).
- **Live Activity Feed:**
  - Scrolling log of recent actions: "User X registered", "Link Y created", "User Z logged in".

### B. User Management (The CRM)

- **Advanced User Table:**
  - Columns: Avatar, Name, Email, Role, Link Count, Total Clicks, Status (Active/Banned), Joined Date.
  - **Filters:** Search by Email, Filter by Role, Filter by Status.
- **User Detail View (Drawer/Modal):**
  - See all links owned by a specific user.
  - **"Shadow Login"**: A button to generate a token and log in _as_ that user to debug issues (High-value feature).
- **Actions:**
  - **Ban/Unban User**: Instantly revokes access.
  - **Reset Password**: Triggers a reset email (or sets a temp password).
  - **Delete User**: Hard delete (with "Type DELETE to confirm" safety).

### C. Content Moderation (The Janitor)

- **Global Link Search:**
  - Search _any_ shortID or Original URL in the database.
- **Safety Tools:**
  - **Phishing Detector**: (Future AI integration) Flag links pointing to known bad domains.
  - **Manual Disable**: Toggle a link to "Inactive" (redirects to a "Link Removed" warning page) without deleting it.
- **Top Performers:**
  - List of top 50 most clicked links globally (to identify viral content or abuse).

### D. System Configuration (The Settings)

- **Feature Toggles:**
  - **Maintenance Mode**: Lock the frontend for non-admins.
  - **Registration Open/Closed**: Stop new signups during high load.
  - **Anonymous Shortening**: Toggle whether non-users can create links.
- **Global Announcement**:
  - Set a banner message that appears on everyone's dashboard (e.g., "Scheduled Maintenance at 2 AM").

### E. Appeal Management (The Judge)

- **Appeal Review Interface**:
  - View list of pending appeals from banned users.
  - See user details, ban reason, and their appeal message.
- **Action States**:
  - **Unban**: Immediately restores access.
  - **Reject**: Keeps user banned, increments their appeal count (max 3).
  - **Unban Pending**: Approves the appeal but keeps the account locked until further admin action (e.g., "Probation").
- **Appeal Limits**:
  - System automatically blocks appeals after 3 rejections per ban session.

---

## 3. UI/UX Specifications

### Layout & Navigation

- **Structure**: Dedicated `AdminLayout` separate from User Dashboard.
- **Sidebar**:
  - 📊 Overview
  - 👥 Users
  - 🔗 Links
  - ⚙️ Settings
- **Theme**: Distinct visual cue (e.g., a red accent border or "ADMIN" badge) so you know you are in a privileged environment.

### Component Strategy

- **Data Tables**: Must support **Server-Side Pagination** (we can't load 10,000 users at once).
- **Action Menus**: "Three-dot" menu on every table row for quick actions.
- **Confirmation Modals**: Critical for destructive actions (Banning, Deleting).
- **Toast Notifications**: Immediate feedback for every admin action.

---

## 4. Technical Implementation (API Requirements)

### Middleware

- `verifyAdmin`: Extends `verifyToken`. Checks `if (req.user.role !== 'admin') return 403`.

### Endpoints

- `GET /api/admin/stats` - Aggregated counters.
- `GET /api/admin/users` - Paginated user list with search.
- `GET /api/admin/users/:id` - Specific user details.
- `PATCH /api/admin/users/:id/status` - Ban/Unban.
- `GET /api/admin/links` - Global link search.
- `PATCH /api/admin/links/:id/disable` - Moderation action.
- `POST /api/admin/system/announcement` - Set global banner.
