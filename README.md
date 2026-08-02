# 🔗 Link-Snap

> **Advanced URL Shortening, Analytics, & Bio-Link Platform with Stealth Security.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.7.1-blue.svg)](package.json)
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
*   **Kubernetes (K3s/K8s)** - Stateless microservices architecture for the backend API and Redis cache. Engineered with `startupProbe`, `livenessProbe`, `readinessProbe`, and HPA for self-healing and auto-scaling.
*   **Cloudflare Zero Trust** - Frontend hosted globally via Pages. Backend traffic routed securely into K8s via Cloudflare Tunnels (cloudflared) and Edge BFF Proxies without exposing any public host ports.
*   **Terraform & FinOps** - Declarative IaC provisioning of OCI ARM64 (A1.Flex) instances, VCN, and Security Lists. Architected to run entirely within the "Always Free" tier for $0/month infrastructure costs.
*   **Docker Buildx** - Multi-stage optimized ARM64 container images hosted on Docker Hub.
*   **GitHub Actions (DevSecOps)** - Enterprise CI/CD pipeline with `actionlint`, `hadolint`, `kubeconform`, and Trivy vulnerability scanning. Automated zero-downtime rolling deployments (`maxUnavailable: 0`) with `kubectl rollout undo` rollback failsafes.
*   **Redis & MongoDB** - Distributed state management for rate limiting, WebAuthn challenges, and complex aggregation pipelines.

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

1.  **Device Bound Session Credentials (DBSC)**: Dual-layer token architecture (In-memory short-lived Access Tokens + HTTP-Only, Secure, SameSite=Strict Refresh Cookies). This entirely prevents XSS payload exfiltration and CSRF attacks.
2.  **WebAuthn / Biometric Fingerprinting**: Highly privileged Admin actions require physical security keys (FIDO2) or biometrics, bypassing all automated scanners.
3.  **Cryptographic Webhook Verification**: Background job queues (BullMQ) verify HMAC-SHA256 signatures via `crypto.timingSafeEqual()` to prevent side-channel timing attacks.
4.  **Redis Bloom Filters**: Token validation lookups are executed in O(1) time complexity using probabilistic data structures, defending against database exhaustion DDoS vectors.
5.  **Multi-Tier IP Verification**: Admin and privileged routes traverse the proxy chain and strictly validate `x-forwarded-for` against localized IP whitelists.

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
