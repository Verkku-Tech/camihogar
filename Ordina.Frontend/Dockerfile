# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copiar archivos de dependencias
COPY package.json ./

# Instalar dependencias
# Nota: Si pnpm-lock.yaml existe en el contexto, debería copiarse antes de este paso
# Por ahora, instalamos sin --frozen-lockfile para que funcione sin el lockfile
RUN pnpm install

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Versión de la app (inyectada en build para PWA y NEXT_PUBLIC_APP_VERSION)
ARG GIT_SHA=dev
ENV NEXT_PUBLIC_APP_VERSION=${GIT_SHA}

# Copiar dependencias instaladas
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables de entorno para el build (ajustar según necesidad)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Construir la aplicación
RUN pnpm build

# Deploy PWA: cada build genera APP_VERSION única (prebuild).
# Los usuarios ven un banner de actualización; si no actúan, recarga automática en ~5 min.
# Para cambios que rompan datos offline, incrementar migraciones en bootSync (lib/storage.ts).

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Crear usuario no-root para seguridad
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar archivos necesarios
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Cambiar ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

