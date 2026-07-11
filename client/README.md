# Link-Snap Client

This is the frontend client for the **Link-Snap** application. It is built using React.js and Vite.

## Architecture & Deployment

The frontend operates as a **Progressive Web App (PWA)** and Single Page Application (SPA).
In the production architecture, this client is decoupled from the Kubernetes backend and is instead deployed globally via **Cloudflare Pages**.

### Cloudflare Pages Setup
- The frontend is served directly by Cloudflare Pages.
- Cloudflare Pages Functions (`client/functions/api/[[path]].js`) act as a secure Backend-For-Frontend (BFF).
- The BFF intercepts all `/api/*` requests and securely routes them to the Kubernetes backend via a **Cloudflare Zero Trust Tunnel**.

### Build Scripts
- `npm run dev`: Starts the local development server (with proxy rules for local backend).
- `npm run build`: Compiles the application for production.
- `npm run lint`: Runs ESLint checks.

## Environment Variables

When deploying or building, the following build arguments/environment variables are used:
- `VITE_BASE_URL`
- `VITE_DOMAIN`
- `VITE_API_URL` (Typically `/api` to route through the BFF)
