# syntax=docker/dockerfile:1
# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM node:24-alpine AS deps

WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts


# ── Stage 2: Production image ──────────────────────────────────────────────────
FROM node:24-alpine AS production

# tini: tiny init system to forward signals and reap zombie processes
# hadolint ignore=DL3018
RUN apk update && apk upgrade --no-cache && apk add --no-cache tini \
    && rm -rf /usr/local/lib/node_modules/npm \
              /usr/local/bin/npm \
              /usr/local/bin/npx \
              /usr/local/bin/yarn \
              /usr/local/bin/yarnpkg \
              /opt/yarn*

WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/tanaymondal56/Link-Snap" \
      org.opencontainers.image.description="Link-Snap Backend API Server" \
      org.opencontainers.image.licenses="MIT"

# Non-root user: explicitly assign UID 1000 and remove default 'node' user
RUN deluser --remove-home node && \
    addgroup -g 1000 linksnap && \
    adduser -u 1000 -G linksnap -s /bin/sh -D linksnap

# Copy deps from previous stage
COPY --link --from=deps --chown=1000:1000 /app/node_modules ./node_modules

# Copy server source (only server folder files)
COPY --link --chown=1000:1000 server/ ./

USER linksnap

ARG MAX_OLD_SPACE_SIZE=350
ENV NODE_ENV=production \
    PORT=5000 \
    NODE_OPTIONS="--max-old-space-size=${MAX_OLD_SPACE_SIZE}"

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "index.js"]
