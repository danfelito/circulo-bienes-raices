# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install backend dependencies, including the Prisma CLI required to generate the client.
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci
COPY backend/ ./
RUN npx prisma generate

# Build the React/Vite frontend.
WORKDIR /app
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=10000

COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/ ./
COPY --from=builder /app/frontend/dist ./frontend/dist

# The node image includes a non-root user.
RUN chown -R node:node /app
USER node

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1

# Migrations and the idempotent admin bootstrap run before every start.
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/init-admin.js && node src/index.js"]
