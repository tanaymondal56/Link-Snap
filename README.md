# 🔗 Link-Snap

> **Advanced URL Shortening, Analytics, & Bio-Link Platform with Stealth Security.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.5.5-blue.svg)](package.json)
[![Status](https://img.shields.io/badge/status-active-success.svg)]()

**Link-Snap** is a modern, full-stack URL management platform engineered for power users and businesses. Beyond standard link shortening, it offers specific device targeting, comprehensive real-time analytics, and a "Link-in-Bio" page builder, all protected by a military-grade stealth admin system.

---

## 🚀 Key Features

### User-Facing
*   **Smart URL Management**: Create custom aliases (`/my-brand`), set expiration dates, and password-protect sensitive links.
*   **Device Targeting logic**: Automatically route visitors to different destinations based on their device (iOS ➔ App Store, Android ➔ Play Store).
*   **Bio Pages**: A "Linktree-style" profile builder to aggregate your digital presence.
*   **QR Codes**: Instant, high-resolution QR generation for every link.
*   **PWA Support**: Full Progressive Web App with offline access and installability.

### Analytics
*   **Real-Time Dashboards**: Visualize click trends with **Recharts**.
*   **Geographic Data**: Track where your audience is coming from.
*   **Device Breakdown**: Analyze traffic by OS and browser.

### Security & Admin
*   **Stealth Admin Mode**: A hidden biometric/device authentication layer obscured behind `/.d/` endpoints, invisible to standard scanners.
*   **Role-Based Access Control (RBAC)**: Hierarchical permissions (User ➔ Admin ➔ Master Admin).
*   **Hybrid Authentication**: Dual-layer security using short-lived in-memory Access Tokens and HTTP-Only Refresh Cookies.

---

## 🛠 Tech Stack

**Frontend**
*   **React.js (v18+)** with **Vite** for lightning-fast builds.
*   **Tailwind CSS** for modern, responsive styling.
*   **Framer Motion** for smooth interactions and page transitions.
*   **Lucide React** for consistent, beautiful iconography.

**Backend**
*   **Node.js & Express.js** for a robust REST API.
*   **MongoDB (Mongoose)** with Aggregation Pipelines for complex analytics.
*   **JWT & Bcrypt** for industry-standard security.

**DevOps & Tools**
*   **ESLint & Prettier** for code quality.
*   **PostCSS** for CSS processing.
*   **Dev Command Center** - Built-in developer toolkit (`Ctrl+Shift+D`).

---

## 📦 Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/tanaymondal56/Link-Snap.git
    cd Link-Snap
    ```

2.  **Install dependencies** (Root, Client, and Server)
    ```bash
    npm run install:all
    ```

3.  **Environment Setup**
    Create a `.env` file in the `server/` directory:
    ```env
    PORT=5000
    MONGO_URI=mongodb+srv://...
    JWT_ACCESS_SECRET=your_super_secret_access_key
    JWT_REFRESH_SECRET=your_super_secret_refresh_key
    NODE_ENV=development
    CLIENT_URL=http://localhost:5173
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
    *   Frontend: `http://localhost:5173`
    *   Backend: `http://localhost:5000`

---

## 🛡️ Security Architecture

Link-Snap implements a **"Defense in Depth"** strategy:

1.  **Device Fingerprinting**: Admin actions require trusted devices verified via WebAuthn/Biometrics.
2.  **IP Whitelisting**: Key administrative endpoints are locked to known IPs.
3.  **Token Rotation**: Automatic silent refresh of tokens prevents session hijacking while maintaining user convenience.

---

## 🤝 Contributing

Contributions are welcome! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
