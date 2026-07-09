# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Backend
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --only=production

COPY backend/ ./ 
RUN npx prisma generate

# Frontend
WORKDIR /app
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine

WORKDIR /app

# Copy backend
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/ ./

# Copy frontend build
COPY --from=builder /app/frontend/dist ./frontend/dist

# Environment
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Run migrations on startup then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
