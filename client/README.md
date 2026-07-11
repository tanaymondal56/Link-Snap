# Link-Snap - Frontend (SPA Client)

> **React + Vite Frontend Client for the Link-Snap URL Platform, optimized and containerized with Nginx.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.6.5-blue.svg)](https://github.com/tanaymondal56/Link-Snap)
[![Docker Frontend](https://img.shields.io/badge/docker-linksnap--frontend-blue?logo=docker)](https://hub.docker.com/r/tanaymondal/linksnap-frontend)
[![Docker Backend](https://img.shields.io/badge/docker-linksnap--backend-blue?logo=docker)](https://hub.docker.com/r/tanaymondal/linksnap-backend)

---

## 🚀 What is Link-Snap Frontend?

This repository contains the containerized production-ready build of the **Link-Snap** client. It is a Single Page Application (SPA) designed to communicate with the `linksnap-backend` API.

**Key Features Served:**
*   **Intuitive Dashboard**: Manage short links, custom aliases, and expiration configurations.
*   **Bio-Link Page Builder**: Drag-and-drop "Linktree-style" profile manager.
*   **Geographic & Device Analytics**: Interactive dashboards rendered via Recharts.
*   **Password/Targeting Config**: Simple UI to toggle device-based redirections, password protection, and click limits.
*   **Progressive Web App**: Full PWA support with install prompts, service worker caching, and offline status indicators.

---

## 🏗️ Architecture

This container uses a **multi-stage Docker build** to serve the static bundle with security-hardened Nginx configurations:

| Stage | Purpose | Base Image |
|-------|---------|------------|
| **Builder** | Installs dependencies, runs Vite compiler | `node:24-alpine` |
| **Production** | Serves static assets using Nginx | `nginx:1.27-alpine` |

**Key Container Optimizations:**
*   ✅ **Unprivileged execution**: Runs under a non-root `linksnap` user for security.
*   ✅ **Single-Page Application routing**: Custom `nginx.conf` fallback rule to prevent `404` errors on subroutes.
*   ✅ **Compact footprints**: Minimal footprint image (~45MB) with all node devDependencies completely excluded.

---

## 🐳 Quick Start

### 1. Pull the Image
```bash
docker pull tanaymondal/linksnap-frontend:latest
```

### 2. Run the Container
The frontend requires configuration baked in at build time or resolved dynamically via reverse proxy (such as a CDN BFF/Gateway). In standard setups, you expose port `80`:

```bash
docker run -d \
  -p 80:80 \
  --name linksnap-frontend \
  tanaymondal/linksnap-frontend:latest
```

### 3. Access the Application
Open `http://localhost`.

---

## ⚙️ Build Arguments (Baked into Client JS)

Because React is compiled to client-side static assets, frontend environment variables must be injected as **build arguments** during `docker build`:

| Build Arg | Description | Default |
|-----------|-------------|---------|
| `VITE_BASE_URL` | Base canonical domain of the client app | `https://lksnp.qzz.io` |
| `VITE_DOMAIN` | Target short-link cookie domain | `lksnp.qzz.io` |
| `VITE_API_URL` | Route path prefix for backend API | `/api` |

Example of rebuilding locally with custom targets:
```bash
docker build \
  --build-arg VITE_BASE_URL="http://localhost:5000" \
  --build-arg VITE_DOMAIN="localhost" \
  --build-arg VITE_API_URL="/api" \
  -f client/Dockerfile -t my-linksnap-frontend .
```

---

## 📦 Docker Compose Topology (Full Stack)

To run the frontend together with the backend API and MongoDB/Redis stack, refer to the Compose template in the [Link-Snap Backend Docker Hub Page](https://hub.docker.com/r/tanaymondal/linksnap-backend).

---

## 🛡️ Security

*   **Non-Root Execution**: Container process permissions are locked to the `linksnap` system user.
*   **Security Headers**: Custom Nginx configs prevent clickjacking, MIME sniffing, and enforce strict HTTPS.

---

## 🔗 Links

*   **GitHub Repository:** [github.com/tanaymondal56/Link-Snap](https://github.com/tanaymondal56/Link-Snap)
*   **Docker Hub Frontend:** [hub.docker.com/r/tanaymondal/linksnap-frontend](https://hub.docker.com/r/tanaymondal/linksnap-frontend)
*   **Docker Hub Backend:** [hub.docker.com/r/tanaymondal/linksnap-backend](https://hub.docker.com/r/tanaymondal/linksnap-backend)
*   **Docker Hub Profile:** [hub.docker.com/u/tanaymondal](https://hub.docker.com/u/tanaymondal)
*   **LinkedIn Profile:** [linkedin.com/in/tanaymondal](https://www.linkedin.com/in/tanaymondal/)
*   **Live Demo:** [lksnp.qzz.io](https://lksnp.qzz.io/) 🌐
*   **Changelog:** [CHANGELOG.md](https://github.com/tanaymondal56/Link-Snap/blob/master/CHANGELOG.md)
