# Multi-stage build para Vite + nginx (compatible con Render PORT)
FROM node:20-alpine AS builder

WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install --legacy-peer-deps

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Servir con nginx
FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Configuración nginx para SPA + variable PORT de Render
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

EXPOSE 80
CMD /bin/sh -c "envsubst '\$PORT' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"