# Multi-stage build para Vite + nginx
FROM node:20-alpine AS builder

WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install --legacy-peer-deps

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Servir con nginx
FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Configuración nginx para SPA (puerto 80 interno, Render mapea el puerto externo)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]