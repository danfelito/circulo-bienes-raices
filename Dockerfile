# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Backend dependencies and Prisma client
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci
COPY backend/ ./
RUN npx prisma generate

# Frontend build
WORKDIR /app
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine

WORKDIR /app/backend

# Keep Prisma CLI available for production migrations
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/ ./
COPY --from=builder /app/frontend/dist /app/frontend/dist

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

# Apply migrations, create the initial administrator idempotently, then start Express
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && node src/index.js"]
