# 🔗 Link-Snap

> **Advanced URL Shortening, Analytics, & Bio-Link Platform with Stealth Security.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.6.5-blue.svg)](package.json)
[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![Docker Frontend](https://img.shields.io/badge/docker-linksnap--frontend-blue?logo=docker)](https://hub.docker.com/r/tanaymondal/linksnap-frontend)
[![Docker Backend](https://img.shields.io/badge/docker-linksnap--backend-blue?logo=docker)](https://hub.docker.com/r/tanaymondal/linksnap-backend)
[![Docker Profile](https://img.shields.io/badge/docker-profile-blue?logo=docker)](https://hub.docker.com/u/tanaymondal)
[![LinkedIn](https://img.shields.io/badge/linkedin-%230077B5.svg?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/tanaymondal/)

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
*   **Safe Browsing & Anti-Bot**: Real-time URL scanning and intelligent bot protection (`botDetector.js`).
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

**DevOps & Infrastructure**
*   **Kubernetes (K8s)** - Stateless microservices architecture for the backend API and Redis cache, infinitely horizontally scalable.
*   **Cloudflare Ecosystem** - Frontend hosted globally via Cloudflare Pages. Backend traffic routed securely into K8s via Cloudflare Zero Trust Tunnels without exposing any public host ports.
*   **Docker** - Split frontend and backend containers hosted on Docker Hub.
*   **GitHub Actions** - CI/CD pipeline with strict `actionlint` and `hadolint` checks, Trivy vulnerability scanning, and automated zero-downtime rolling deployments to `beta` and `production` environments.
*   **Redis** - Distributed state management for rate limiting and WebAuthn challenges across pods.
*   **ESLint & Prettier** for code quality.

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
    *   Frontend: `http://localhost:3000`
    *   Backend: `http://localhost:5000`

5.  **First Run Setup**
    
    On a **fresh installation** (empty database), the **first user** to register via the frontend is automatically:
    - Promoted to **Admin** role
    - Verified instantly (no email/OTP required)
    
    This lets you immediately access the Admin Panel to configure SMTP and other settings. Subsequent users follow the normal registration flow.

---

## 🛡️ Security Architecture

Link-Snap implements a **"Defense in Depth"** strategy:

1.  **Device Fingerprinting**: Admin actions require trusted devices verified via WebAuthn/Biometrics.
2.  **IP Whitelisting**: Key administrative endpoints are locked to known IPs.
3.  **Token Rotation**: Automatic silent refresh of tokens prevents session hijacking while maintaining user convenience.

---

## 🐳 Kubernetes Quickstart

For production deployment, use the automated bootstrap script or apply the K8s manifests directly:

```bash
# 1. Clone the repository
git clone https://github.com/tanaymondal56/Link-Snap.git
cd Link-Snap

# 2. Copy the environment template
cp deploy.env.example deploy.env
# Edit deploy.env with your MongoDB URI, Redis URL, and secrets

# 3. Deploy to your cluster
./bootstrap.sh
```

Alternatively, you can pull the split microservice images directly from Docker Hub:
- `tanaymondal/linksnap-frontend:latest`
- `tanaymondal/linksnap-backend:latest`

---

## 🤝 Contributing

Contributions are welcome! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 👤 Author

*   **Tanay Mondal** - [LinkedIn](https://www.linkedin.com/in/tanaymondal/) / [GitHub](https://github.com/tanaymondal56)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
