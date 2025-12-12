# Camihogar Monorepo

Monorepo para la aplicación Camihogar que contiene el frontend (Next.js) y el backend (.NET).

## 📁 Estructura del Proyecto.

```
camihogar/
├── Ordina.Frontend/       # Frontend Next.js
│   ├── app/               # Páginas y rutas de Next.js
│   ├── components/        # Componentes React
│   ├── lib/               # Utilidades y clientes API
│   └── ...
├── Ordina.Backend/        # Backend .NET
│   ├── src/
│   │   ├── Application/   # Módulos de aplicación (Orders, Payments, Providers, Security, Users)
│   │   ├── Infrastructure/# Infraestructura compartida
│   │   └── Presentation/  # API Gateway y AppHost
│   └── ...
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

### Configuración Docker

El proyecto utiliza Docker Compose unificado para gestionar todos los servicios:

- **Frontend:** `Ordina.Frontend/Dockerfile`
- **Backend:** `Ordina.Backend/` (múltiples Dockerfiles para cada API)
- **Unificado:** `docker-compose.yml` (raíz del proyecto)

### Servicios Incluidos

El `docker-compose.yml` incluye:

- **Frontend:** Next.js (puerto 3000)
- **API Gateway:** .NET (puertos 8080-8081)
- **Microservicios .NET:**
  - Security API (8082)
  - Users API (8083)
  - Providers API (8084)
  - Orders API (8085)
  - Payments API (8086)
- **Bases de Datos:**
  - PostgreSQL (5432)
  - MongoDB (27017)
  - Redis (6379)
- **Supabase Stack:**
  - Kong (8000, 8443)
  - Auth (Gotrue)
  - Studio (3001)

### Uso de Docker Compose

**Desplegar todos los servicios:**
```bash
docker compose up -d --build
```

**Ver estado de los servicios:**
```bash
docker compose ps
```

**Ver logs:**
```bash
docker compose logs -f
```

**Detener todos los servicios:**
```bash
docker compose down
```

**Reconstruir y desplegar:**
```bash
docker compose up -d --build --remove-orphans
```

### Health Checks

Todos los servicios tienen health checks configurados que verifican:
- **APIs .NET:** Endpoint `/health` usando `curl`
- **Frontend:** Verificación de disponibilidad en puerto 3000
- **PostgreSQL:** Health check nativo de la imagen

Los health checks se ejecutan cada 30 segundos con un período de inicio de 60 segundos.

## 🚀 CI/CD Pipeline

### Despliegue Automático en Raspberry Pi

El proyecto incluye un pipeline de CI/CD configurado con GitHub Actions para despliegue automático en Raspberry Pi.

**Archivo:** `.github/workflows/deploy-rpi.yml`

**Configuración:**
- **Trigger:** Push a la rama `develop`
- **Runner:** Self-hosted en Linux ARM64 (Raspberry Pi)
- **Concurrencia:** Un solo despliegue a la vez

**Proceso del Pipeline:**
1. Sanity checks (Docker, espacio en disco, permisos)
2. Configuración de permisos Docker
3. Instalación de dependencias (curl)
4. Despliegue con `docker compose up`
5. Espera de servicios
6. Health checks post-despliegue
7. Cleanup de imágenes no utilizadas

**Para desplegar:**
```bash
git checkout develop
git push origin develop
```

El workflow se ejecutará automáticamente y desplegará todos los servicios en el RPI.

### Requisitos del Runner

- Docker y Docker Compose instalados
- Usuario en el grupo docker o con permisos sudo
- Espacio en disco suficiente
- Etiquetas: `[self-hosted, Linux, ARM64]`

## 📝 Notas

- El `pnpm-lock.yaml` se encuentra en cada workspace individual
- Los builds se pueden optimizar usando Turbo (ver `turbo.json`)
- El backend usa .NET Solution para gestionar múltiples proyectos
- Las imágenes Docker de las APIs .NET incluyen `curl` para health checks
- El docker-compose.yml usa variables de entorno con valores por defecto para RPI

## 🤝 Contribución

1. Crear una rama desde `main` o `ci/cd`
2. Realizar los cambios
3. Ejecutar `pnpm lint` antes de hacer commit
4. Crear un Pull Request
5. Para desplegar: hacer push a la rama `develop` (despliegue automático)

## 🔍 Troubleshooting

### Problemas con Docker

**Permisos de Docker:**
```bash
# Agregar usuario al grupo docker
sudo usermod -aG docker $USER
# Reiniciar sesión o ejecutar:
newgrp docker
```

**Verificar servicios:**
```bash
# Ver estado de contenedores
docker compose ps

# Ver logs de un servicio específico
docker compose logs <nombre-servicio>

# Verificar health checks
docker inspect <container-name> | grep -A 10 Health
```

### Problemas con el Pipeline

- Verificar que el runner esté en línea y disponible
- Revisar logs en GitHub Actions
- Verificar permisos del usuario en el runner
- Asegurar que hay espacio en disco suficiente

## 📄 Licencia

[Especificar licencia si aplica]

