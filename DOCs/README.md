# Link Snap - Advanced URL Shortener

Link Snap is a modern, full-stack URL shortener featuring detailed analytics, QR code generation, and a robust admin panel. Built with the MERN stack (MongoDB, Express, React, Node.js).

## Features

- **Authentication**: Secure user registration and login (JWT + HttpOnly Cookies).
- **Link Management**: Create, edit, and delete short links.
- **Custom Aliases**: Create branded links (e.g., `mysite.com/summer-sale`).
- **QR Codes**: Auto-generated QR codes for every link.
- **Analytics**: Track clicks, location (Country/City), device type, and browser.
- **Admin Panel**:
  - **User Management**: View, Ban, or Delete users.
  - **Link Moderation**: Search all links, Disable/Enable links, or Delete them.
  - **System Settings**: Toggle Email Verification requirement globally.
  - **System Stats**: View total users, links, and clicks.
- **Responsive UI**: "Cosmic Glass" theme built with Tailwind CSS.

## User Roles

- **User**: Standard role. Can create links, view their own analytics, and manage their own profile.
- **Admin**: Elevated privileges. Can access the Admin Dashboard to manage all users, moderate links, view system-wide statistics, and configure global settings.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Recharts, Framer Motion.
- **Backend**: Node.js, Express, MongoDB, Mongoose.
- **Security**: Helmet, Rate Limiting, Mongo Sanitize, JWT.
- **DevOps**: Docker, Docker Compose.

## Getting Started

### Prerequisites

- Node.js (v18+)
- MongoDB (Local or Atlas)

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/yourusername/link-snap.git
    cd link-snap
    ```

2.  **Install Dependencies:**

    ```bash
    # Server
    cd server
    npm install

    # Client
    cd ../client
    npm install
    ```

3.  **Environment Setup:**

    Create `server/.env`:

    ```env
    PORT=5000
    MONGO_URI=mongodb://localhost:27017/linksnap
    JWT_ACCESS_SECRET=your_access_secret_key
    JWT_REFRESH_SECRET=your_refresh_secret_key
    NODE_ENV=development
    CLIENT_URL=http://localhost:5173
    EMAIL_USERNAME=your_gmail_address
    EMAIL_PASSWORD=your_gmail_app_password
    ```

    > **Note:** For Gmail, you must use an **App Password** (not your login password). Enable 2FA on your Google Account and generate an App Password.

4.  **Run Locally:**

    ```bash
    # Terminal 1 (Server)
    cd server
    npm run dev

    # Terminal 2 (Client)
    cd client
    npm run dev
    ```

### Docker Deployment

Run the entire stack with a single command:

```bash
docker-compose up --build
```

The app will be available at `http://localhost`.

## How to Use

### 1. User Features

- **Sign Up**: Create an account at `/register`.
- **Create Link**: Paste a long URL in the dashboard input. Optionally add a custom alias (e.g., `my-link`).
- **QR Code**: Click the QR icon in your link list to download.
- **Analytics**: Click the chart icon to view detailed stats (Location, Device, etc.).

### 2. Admin Features

To access the admin panel, you must promote a user to the 'admin' role.

1.  **Register** a new user via the frontend (e.g., `admin@example.com`).
2.  **Run the Admin Script**:

    ```bash
    cd server
    node scripts/makeAdmin.js admin@example.com
    ```

    **Manual User Registration:**
    If you need to create a user manually (bypassing email verification), use:

    ```bash
    node scripts/registerUser.js <email> <password> [role]
    # Example: node scripts/registerUser.js user@test.com password123 admin
    ```

3.  **Log out and Log back in**.
4.  Navigate to `/admin` (or click the Admin link in the sidebar if visible).
5.  **Manage Users**: Ban or delete users from the "Users" tab.
6.  **Manage Links**: Switch to the "Links & Moderation" tab to search for any URL in the system and disable/delete it.

## License

MIT

## Documentation Index

For detailed architectural decisions and implementation plans, refer to the following documents:

- **[Project Plan](./PROJECT_PLAN.md)**: High-level roadmap and feature breakdown.
- **[Master Execution Plan](./MASTER_EXECUTION_PLAN.md)**: Step-by-step implementation checklist.
- **[Login System](./LOGIN_SYSTEM_DOCUMENTATION.md)**: Complete authentication flow, security, and token strategy.
- **[Security & Ban System](./SECURITY_OPTIMIZATION.md)**: Security hardening, ban logic, and appeal workflows.
- **[Admin Panel](./ADMIN_PANEL_PLAN.md)**: Admin features, user management, and moderation tools.
- **[User Dashboard](./USER_DASHBOARD_PLAN.md)**: User-facing features and UI/UX plans.
- **[Analytics Strategy](./ANALYTICS_STRATEGY.md)**: Data collection and visualization strategy.
- **[Expansion Strategy](./EXPANSION_AND_TEMPLATE_STRATEGY.md)**: Future roadmap and scalability plans.
