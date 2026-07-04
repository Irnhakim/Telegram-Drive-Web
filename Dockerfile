# ── Build Stage: Frontend ────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# ── Build Stage: Backend ─────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

COPY server/ ./
RUN npx tsc

# ── Runtime ──────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Install production dependencies for server
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy compiled backend
COPY --from=backend-builder /app/server/dist ./server/dist

# Copy frontend build
COPY --from=frontend-builder /app/client/dist ./client/dist

# Create data directory
RUN mkdir -p /app/data

# Environment
ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "server/dist/index.js"]
