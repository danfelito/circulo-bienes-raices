# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Prisma necesita OpenSSL para detectar el motor correcto en Alpine.
RUN apk add --no-cache openssl libc6-compat

# Prisma validates DATABASE_URL while generating the client. This value is
# build-only; Render injects the real DATABASE_URL in the production container.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

# Backend
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/
WORKDIR /app/backend
RUN npm ci --include=dev

COPY backend/ ./

# Frontend
WORKDIR /app
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine

# Preserve the monorepo layout expected by backend/src/index.js.
WORKDIR /app/backend

# Prisma también necesita OpenSSL durante las migraciones y en runtime.
RUN apk add --no-cache openssl libc6-compat

# Copy backend
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/ ./

# Copy frontend build beside the backend directory.
COPY --from=builder /app/frontend/dist /app/frontend/dist

# Environment
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Apply migrations, synchronize the administrator, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run ensure-admin && node src/index.js"]
