# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copiar archivos de dependencias desde el monorepo
# Mantener la estructura del workspace para que pnpm funcione correctamente
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY Ordina.Frontend/package.json ./Ordina.Frontend/package.json

# Instalar dependencias (pnpm instalará desde el workspace)
# Intenta usar lockfile si está actualizado, si no, instala sin él
RUN pnpm install --frozen-lockfile || pnpm install

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copiar toda la estructura del workspace desde deps (incluye node_modules y dependencias)
COPY --from=deps /app ./

# Copiar el código fuente del frontend (sobrescribe lo que ya está instalado)
COPY Ordina.Frontend/ ./Ordina.Frontend/

# Cambiar al directorio del frontend para el build
WORKDIR /app/Ordina.Frontend

# Variables de entorno para el build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Construir la aplicación
RUN pnpm build

# Stage 3: Production with NGINX
FROM nginx:alpine AS runner

# Instalar Node.js para ejecutar Next.js
RUN apk add --no-cache nodejs npm

# Copiar archivos de Next.js standalone
# El build está en /app/Ordina.Frontend debido a la estructura del workspace
COPY --from=builder /app/Ordina.Frontend/.next/standalone /app
COPY --from=builder /app/Ordina.Frontend/.next/static /app/.next/static
COPY --from=builder /app/Ordina.Frontend/public /app/public

# Configurar NGINX para hacer proxy a Next.js
RUN rm /etc/nginx/conf.d/default.conf && \
    echo 'server {' > /etc/nginx/conf.d/default.conf && \
    echo '    listen 80;' >> /etc/nginx/conf.d/default.conf && \
    echo '    server_name _;' >> /etc/nginx/conf.d/default.conf && \
    echo '' >> /etc/nginx/conf.d/default.conf && \
    echo '    # Gzip compression' >> /etc/nginx/conf.d/default.conf && \
    echo '    gzip on;' >> /etc/nginx/conf.d/default.conf && \
    echo '    gzip_vary on;' >> /etc/nginx/conf.d/default.conf && \
    echo '    gzip_min_length 1024;' >> /etc/nginx/conf.d/default.conf && \
    echo '    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;' >> /etc/nginx/conf.d/default.conf && \
    echo '' >> /etc/nginx/conf.d/default.conf && \
    echo '    # Security headers' >> /etc/nginx/conf.d/default.conf && \
    echo '    add_header X-Frame-Options "SAMEORIGIN" always;' >> /etc/nginx/conf.d/default.conf && \
    echo '    add_header X-Content-Type-Options "nosniff" always;' >> /etc/nginx/conf.d/default.conf && \
    echo '    add_header X-XSS-Protection "1; mode=block" always;' >> /etc/nginx/conf.d/default.conf && \
    echo '' >> /etc/nginx/conf.d/default.conf && \
    echo '    # Proxy to Next.js server' >> /etc/nginx/conf.d/default.conf && \
    echo '    location / {' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_pass http://127.0.0.1:3000;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_http_version 1.1;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_set_header Upgrade $http_upgrade;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_set_header Connection "upgrade";' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_set_header Host $host;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_set_header X-Real-IP $remote_addr;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_set_header X-Forwarded-Proto $scheme;' >> /etc/nginx/conf.d/default.conf && \
    echo '        proxy_cache_bypass $http_upgrade;' >> /etc/nginx/conf.d/default.conf && \
    echo '    }' >> /etc/nginx/conf.d/default.conf && \
    echo '}' >> /etc/nginx/conf.d/default.conf

# Script para iniciar Next.js y NGINX
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'cd /app && PORT=3000 HOSTNAME=127.0.0.1 node server.js &' >> /start.sh && \
    echo 'exec nginx -g "daemon off;"' >> /start.sh && \
    chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]
