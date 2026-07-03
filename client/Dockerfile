# ── Stage 1: Build the React SPA ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (cache layer — only invalidated when package.json changes)
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy source (invalidates cache when source changes)
COPY . .

# Build-time env vars (public values only — these are baked into the JS bundle)
ARG VITE_BASE_URL=https://lksnp.qzz.io
ARG VITE_DOMAIN=lksnp.qzz.io
ARG VITE_API_URL=/api

ENV VITE_BASE_URL=$VITE_BASE_URL \
    VITE_DOMAIN=$VITE_DOMAIN \
    VITE_API_URL=$VITE_API_URL

RUN npm run build


# ── Stage 2: Serve with Nginx ──────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Remove default Nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx SPA config (the one already in client/)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Non-root user for security
RUN addgroup -S linksnap && adduser -S -G linksnap linksnap \
    && chown -R linksnap:linksnap /usr/share/nginx/html \
    && chown -R linksnap:linksnap /var/cache/nginx \
    && chown -R linksnap:linksnap /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown linksnap:linksnap /var/run/nginx.pid

USER linksnap

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
