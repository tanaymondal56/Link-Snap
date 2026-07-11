# Link-Snap - Backend (REST API Server)

> **Secure Express.js REST API for the Link-Snap URL Platform, optimized and containerized with Node.js Alpine and Tini.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.6.5-blue.svg)](https://github.com/tanaymondal56/Link-Snap)
[![Docker Frontend](https://img.shields.io/badge/docker-linksnap--frontend-blue?logo=docker)](https://hub.docker.com/r/tanaymondal/linksnap-frontend)
[![Docker Backend](https://img.shields.io/badge/docker-linksnap--backend-blue?logo=docker)](https://hub.docker.com/r/tanaymondal/linksnap-backend)

---

## 🚀 What is Link-Snap Backend?

This repository contains the containerized REST API server for the **Link-Snap** platform. It handles database transactions, short URL redirections, analytics collection, biometric challenges, rate limiting, and administration endpoints.

**Key Features Implemented:**
*   **Highly Scalable Redirections**: Optimized routes for rapid target resolution with device targeting and password verification support.
*   **Stealth Admin Access**: A hidden authentication layer (`/.d/` endpoints) protected by WebAuthn/FIDO2 biometrics, designed to bypass automatic scanners.
*   **Real-Time Safe Browsing**: Integrates real-time URL classification and anti-phishing threat database checks.
*   **Anti-Bot & Rate Limiting**: Distributed rate-limiting system using Redis and intelligent bot detection.
*   **Mongoose Aggregations**: Performs geo-analytics, device breakdowns, and click metrics computations.

---

## 🏗️ Architecture

This container uses a **multi-stage Docker build** to keep the image secure and lightweight:

| Stage | Purpose | Base Image |
|-------|---------|------------|
| **Deps** | Installs production NPM packages | `node:24-alpine` |
| **Production** | Runs the Express API under unprivileged user | `node:24-alpine` |

**Key Container Optimizations:**
*   ✅ **Tini init handler**: Leverages `tini` as `ENTRYPOINT` to ensure zombie processes are reaped and OS signals (`SIGTERM`, `SIGINT`) are handled gracefully.
*   ✅ **Unprivileged execution**: Process permissions are strictly bound to the `linksnap` system user.
*   ✅ **Caching**: Docker layers separated by lockfile copy commands to ensure fast re-builds.
*   ✅ **Clean footprint**: Zero development dependencies, tests, or documentation compiled into the final image.

---

## ⚙️ Environment Variables

The backend API requires the following environment variables to run:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Local port the container exposes | No | `5000` |
| `MONGO_URI` | MongoDB connection URL | **Yes** | - |
| `JWT_ACCESS_SECRET` | HS256 secret key for signing short-lived tokens | **Yes** | - |
| `JWT_REFRESH_SECRET` | HS256 secret key for signing session cookies | **Yes** | - |
| `SESSION_SECRET` | Cookie session encrypt key | **Yes** | - |
| `ENCRYPTION_KEY` | Hex encryption key for URL passwords | **Yes** | - |
| `REDIS_URL` | Redis server URL (TCP) for rate limiting | No | - |
| `REDIS_PASSWORD` | Redis authentication password | No | - |
| `NODE_ENV` | Environment context (`production` or `development`) | No | `production` |
| `CLIENT_URL` | Frontend client origin to permit CORS | **Yes** | - |

---

## 📦 Full-Stack Docker Compose Quickstart

Here is the recommended configuration to bootstrap the entire Link-Snap application (Client, API Server, MongoDB, and local Redis cache) in one command:

```yaml
version: '3.8'

services:
  # Frontend Client
  linksnap-frontend:
    image: tanaymondal/linksnap-frontend:latest
    container_name: linksnap-frontend
    ports:
      - "80:80"
    restart: unless-stopped
    depends_on:
      - linksnap-backend

  # Backend Express API
  linksnap-backend:
    image: tanaymondal/linksnap-backend:latest
    container_name: linksnap-backend
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - PORT=5000
      - MONGO_URI=mongodb://linksnap-mongo:27017/linksnap
      - JWT_ACCESS_SECRET=your_super_secret_jwt_access_key
      - JWT_REFRESH_SECRET=your_super_secret_jwt_refresh_key
      - SESSION_SECRET=your_cookie_session_encrypt_secret
      - ENCRYPTION_KEY=32_byte_hex_encryption_key_goes_here
      - REDIS_URL=redis://default:your_redis_password@linksnap-redis:6379
      - CLIENT_URL=http://localhost  # Matches frontend URL
    depends_on:
      - linksnap-mongo
      - linksnap-redis
    restart: unless-stopped

  # Distributed cache (Rate limiting / WebAuthn state)
  linksnap-redis:
    image: redis:7-alpine
    container_name: linksnap-redis
    command: redis-server --requirepass your_redis_password
    restart: unless-stopped

  # Database Engine
  linksnap-mongo:
    image: mongo:6-jammy
    container_name: linksnap-mongo
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

volumes:
  mongo_data:
```

### Bootstrap instruction:
1. Copy the YAML block above to a file named `docker-compose.yml`.
2. Generate secure strings for your `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`, and `ENCRYPTION_KEY`.
3. Start the stack:
   ```bash
   docker compose up -d
   ```
4. Access the web dashboard at `http://localhost`.

---

## 🔗 Links

*   **GitHub Repository:** [github.com/tanaymondal56/Link-Snap](https://github.com/tanaymondal56/Link-Snap)
*   **Docker Hub Frontend:** [hub.docker.com/r/tanaymondal/linksnap-frontend](https://hub.docker.com/r/tanaymondal/linksnap-frontend)
*   **Docker Hub Backend:** [hub.docker.com/r/tanaymondal/linksnap-backend](https://hub.docker.com/r/tanaymondal/linksnap-backend)
*   **Docker Hub Profile:** [hub.docker.com/u/tanaymondal](https://hub.docker.com/u/tanaymondal)
*   **Live Demo:** [lksnp.qzz.io](https://lksnp.qzz.io/) 🌐
*   **Changelog:** [CHANGELOG.md](https://github.com/tanaymondal56/Link-Snap/blob/master/CHANGELOG.md)
