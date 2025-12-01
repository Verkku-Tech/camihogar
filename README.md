# Camihogar Monorepo

Monorepo para la aplicación Camihogar que contiene el frontend (Next.js) y el backend (.NET).

## 📁 Estructura del Proyecto

```
camihogar/
├── Ordina.Frontend/       # Frontend Next.js
│   ├── app/               # Páginas y rutas de Next.js
│   ├── components/        # Componentes React
│   ├── lib/               # Utilidades y clientes API
│   └── Dockerfile         # Dockerfile del frontend
├── Ordina.Backend/        # Backend .NET
│   ├── src/
│   │   ├── Application/   # Módulos de aplicación (Orders, Payments, Providers, Security, Users)
│   │   ├── Infrastructure/# Infraestructura compartida
│   │   └── Presentation/  # API Gateway y AppHost
│   └── Dockerfile          # Dockerfile unificado del backend
├── .github/
│   └── workflows/
│       └── deploy.yml     # CI/CD workflow
├── docs/                  # Documentación
│   ├── DEPLOYMENT.md      # Guía de despliegue
│   └── SETUP_GITHUB_SECRETS.md  # Configuración de secrets
├── scripts/               # Scripts de despliegue
│   └── deploy.sh          # Script de despliegue para Raspberry Pi
├── docker-compose.yml     # Configuración Docker para producción
├── env.example            # Plantilla de variables de entorno
├── package.json           # Configuración del monorepo
├── pnpm-workspace.yaml    # Configuración de workspaces de pnpm
└── turbo.json            # Configuración de Turbo para builds
```

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- .NET SDK (para el backend)
- Docker (opcional, para desarrollo local)

### Instalación

1. Instalar dependencias:
```bash
pnpm install
```

2. Ejecutar el frontend en modo desarrollo:
```bash
pnpm dev
```

El frontend estará disponible en `http://localhost:3000`

### Scripts Disponibles

Desde la raíz del monorepo:

- `pnpm dev` - Inicia el servidor de desarrollo del frontend
- `pnpm build` - Construye el frontend para producción
- `pnpm start` - Inicia el frontend en modo producción
- `pnpm lint` - Ejecuta el linter del frontend
- `pnpm clean` - Limpia todos los node_modules

Para ejecutar comandos en un workspace específico:

```bash
pnpm --filter Ordina.Frontend <comando>
```

## 🏗️ Workspaces

Este monorepo utiliza pnpm workspaces para gestionar múltiples paquetes:

- **Ordina.Frontend**: Aplicación Next.js con TypeScript y Tailwind CSS

## 🔧 Desarrollo

### Frontend

El frontend está construido con:
- Next.js 14
- React 19
- TypeScript
- Tailwind CSS
- Radix UI
- React Hook Form + Zod

### Backend

El backend está construido con:
- .NET (múltiples proyectos)
- Arquitectura modular (Orders, Payments, Providers, Security, Users)
- API Gateway
- Supabase (base de datos)

## 📦 Gestión de Dependencias

Este proyecto usa `pnpm` como gestor de paquetes. Las dependencias se instalan desde la raíz:

```bash
pnpm install
```

Para agregar una dependencia a un workspace específico:

```bash
pnpm --filter Ordina.Frontend add <paquete>
```

## 🐳 Docker

El proyecto tiene un `docker-compose.yml` unificado en la raíz que incluye todos los servicios.

### Servicios Disponibles (Producción)

| Servicio | Puerto | Descripción | URL |
|----------|--------|-------------|-----|
| **Frontend** | 80 | Aplicación Next.js con NGINX | http://localhost |
| **Backend** | 5000 | API Gateway .NET | http://localhost:5000 |
| **MongoDB** | 27017 | Base de datos NoSQL | localhost:27017 |
| **Redis** | 6379 | Cache distribuido | localhost:6379 |
| **Watchtower** | - | Actualización automática de contenedores | - |

### Iniciar todos los servicios

```bash
# Desde la raíz del proyecto
docker-compose up -d

# Ver logs de todos los servicios
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f frontend
docker-compose logs -f security-api

# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes (⚠️ elimina datos)
docker-compose down -v

# Reconstruir imágenes
docker-compose up --build -d
```

### Dockerfiles

- Frontend: `Ordina.Frontend/Dockerfile` - Next.js con NGINX
- Backend: `Ordina.Backend/Dockerfile` - Dockerfile unificado para API Gateway

## 🚀 CI/CD y Despliegue

Este proyecto incluye CI/CD automatizado con GitHub Actions y GitHub Container Registry (GHCR) usando un sistema **pull-based** con Watchtower.

### Flujo de CI/CD

1. **Push a GitHub** → Se activa el workflow `.github/workflows/deploy.yml`
2. **Build Multi-Arch** → Se compilan imágenes Docker para amd64, arm64 y arm/v7
3. **Push a GHCR** → Las imágenes se suben automáticamente a GitHub Container Registry
4. **Despliegue Automático** → Watchtower en la Raspberry Pi detecta y actualiza automáticamente cada 30 segundos

### Configuración

1. **GitHub Secrets** (Settings → Secrets and variables → Actions):
   - `GHCR_TOKEN`: Token de GitHub con permisos `write:packages` (requerido)
   - `GHCR_USERNAME`: (Opcional) Tu usuario de GitHub
   - `FRONTEND_IMAGE`: (Opcional) Nombre de la imagen frontend
   - `BACKEND_IMAGE`: (Opcional) Nombre de la imagen backend

   Ver [docs/SETUP_GITHUB_SECRETS.md](./docs/SETUP_GITHUB_SECRETS.md) para instrucciones detalladas.

2. **Raspberry Pi**:
   ```bash
   git clone https://github.com/tu-usuario/camihogar.git
   cd camihogar
   cp env.example .env
   # Editar .env con tus valores (USERNAME, etc.)
   chmod +x scripts/deploy.sh
   ./scripts/deploy.sh
   ```

### Archivos de CI/CD

- `.github/workflows/deploy.yml` - Workflow de GitHub Actions con multi-arch build
- `docker-compose.yml` - Configuración para producción (usa imágenes de GHCR)
- `scripts/deploy.sh` - Script de despliegue para la Raspberry Pi
- `docs/DEPLOYMENT.md` - Guía completa de despliegue
- `docs/SETUP_GITHUB_SECRETS.md` - Configuración de GitHub Secrets

Ver [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) para más detalles sobre el despliegue.

## 📝 Notas

- El `pnpm-lock.yaml` se encuentra en cada workspace individual
- Los builds se pueden optimizar usando Turbo (ver `turbo.json`)
- El backend usa .NET Solution para gestionar múltiples proyectos
- Las imágenes Docker son multi-architectura (amd64, arm64, arm/v7) para compatibilidad con Raspberry Pi
- Watchtower actualiza automáticamente los contenedores cada 30 segundos
- El sistema usa GitHub Container Registry (GHCR) para almacenar las imágenes

## 🤝 Contribución

1. Crear una rama desde `main`
2. Realizar los cambios
3. Ejecutar `pnpm lint` antes de hacer commit
4. Crear un Pull Request

## 📄 Licencia

[Especificar licencia si aplica]

