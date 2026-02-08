# ═══════════════════════════════════════════════════════════════════════════════
# DOCKERFILE - LinkSnap Multi-Stage Build
# ═══════════════════════════════════════════════════════════════════════════════
# Your project has 3 package.json files:
#   - Root: /package.json (for dev scripts like concurrently)
#   - Client: /client/package.json (React + Vite dependencies)
#   - Server: /server/package.json (Express + MongoDB dependencies)
#
# This Dockerfile installs dependencies for each separately for better caching!

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 1: BUILDER - Install dependencies and build frontend
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:alpine AS builder

WORKDIR /app

# ───────────────────────────────────────────────────────────────────────────────
# Step 1: Copy ONLY package files (for caching!)
# ───────────────────────────────────────────────────────────────────────────────
# Why? If package.json doesn't change, Docker reuses cached node_modules!
# This saves 5+ minutes on every rebuild when you only change source code.

# Root package.json (has concurrently, wait-on - not needed in production)
COPY package*.json ./

# Client package.json (React, Vite, etc.)
COPY client/package*.json ./client/

# Server package.json (Express, MongoDB, etc.)
COPY server/package*.json ./server/

# ───────────────────────────────────────────────────────────────────────────────
# Step 2: Install dependencies for CLIENT and SERVER
# ───────────────────────────────────────────────────────────────────────────────
# We install client and server separately because they have different dependencies
# Root dependencies (concurrently) are only for local dev, not needed in Docker!

# Install client dependencies (includes Vite, React, etc.)
RUN cd client && npm ci --legacy-peer-deps

# Install server dependencies (includes Express, MongoDB driver, etc.)
RUN cd server && npm ci

# ───────────────────────────────────────────────────────────────────────────────
# Step 3: Copy source code
# ───────────────────────────────────────────────────────────────────────────────
# Now copy the actual code (after dependencies are installed and cached)

COPY client/ ./client/
COPY server/ ./server/

# ───────────────────────────────────────────────────────────────────────────────
# Step 4: Build the frontend
# ───────────────────────────────────────────────────────────────────────────────
# This creates client/dist/ with optimized HTML, CSS, JS

RUN cd client && npm run build

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 2: PRODUCTION - Copy only what's needed to run
# ═══════════════════════════════════════════════════════════════════════════════
# This stage creates the FINAL image that gets deployed
# We start fresh and only copy runtime files (no build tools, no source code!)

FROM node:alpine

WORKDIR /app

# ───────────────────────────────────────────────────────────────────────────────
# Copy ONLY runtime files from builder stage
# ───────────────────────────────────────────────────────────────────────────────

# 1. Copy server dependencies (Express, MongoDB driver, etc.)
#    These are needed to run: node server/index.js
COPY --from=builder /app/server/node_modules ./server/node_modules

# 2. Copy built frontend (HTML, CSS, JS - already optimized!)
#    This is what Express serves with express.static()
COPY --from=builder /app/client/dist ./client/dist

# 3. Copy server source code (your Express app)
COPY --from=builder /app/server ./server

# ───────────────────────────────────────────────────────────────────────────────
# Configuration
# ───────────────────────────────────────────────────────────────────────────────

# Expose port
EXPOSE 5000

# Set to production mode
ENV NODE_ENV=production

# Start the server
CMD ["node", "server/index.js"]