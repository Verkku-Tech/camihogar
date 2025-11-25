# Camihogar Monorepo

Monorepo para la aplicación Camihogar que contiene el frontend (Next.js) y el backend (.NET).

## 📁 Estructura del Proyecto

```
camihogar/
├── FrontendCamihogar/     # Frontend Next.js
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
pnpm --filter FrontendCamihogar <comando>
```

## 🏗️ Workspaces

Este monorepo utiliza pnpm workspaces para gestionar múltiples paquetes:

- **FrontendCamihogar**: Aplicación Next.js con TypeScript y Tailwind CSS

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
pnpm --filter FrontendCamihogar add <paquete>
```

## 🐳 Docker

El proyecto tiene un `docker-compose.yml` unificado en la raíz que incluye todos los servicios.

### Servicios Disponibles

| Servicio | Puerto | Descripción | URL |
|----------|--------|-------------|-----|
| **Frontend** | 3000 | Aplicación Next.js | http://localhost:3000 |
| **Supabase Studio** | 3001 | Interfaz de gestión DB | http://localhost:3001 |
| **Kong Gateway** | 8000, 8443 | API Gateway de Supabase | http://localhost:8000 |
| **API Gateway** | 8080-8081 | Gateway principal | http://localhost:8080 |
| **Security API** | 8082 | Autenticación y autorización | http://localhost:8082/swagger |
| **Users API** | 8083 | Gestión de usuarios | http://localhost:8083/swagger |
| **Providers API** | 8084 | Proveedores y productos | http://localhost:8084/swagger |
| **Orders API** | 8085 | Gestión de pedidos | http://localhost:8085/swagger |
| **Payments API** | 8086 | Procesamiento de pagos | http://localhost:8086/swagger |
| **PostgreSQL** | 5432 | Base de datos principal | localhost:5432 |
| **MongoDB** | 27017 | Base de datos NoSQL | localhost:27017 |
| **Redis** | 6379 | Cache distribuido | localhost:6379 |

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

### Servicios individuales

- Frontend: `FrontendCamihogar/Dockerfile`
- Backend: Cada microservicio tiene su `Dockerfile` en `Ordina.Backend/src/Application/[Service]/Ordina.[Service].Api/`

## 📝 Notas

- El `pnpm-lock.yaml` se encuentra en cada workspace individual
- Los builds se pueden optimizar usando Turbo (ver `turbo.json`)
- El backend usa .NET Solution para gestionar múltiples proyectos

## 🤝 Contribución

1. Crear una rama desde `main`
2. Realizar los cambios
3. Ejecutar `pnpm lint` antes de hacer commit
4. Crear un Pull Request

## 📄 Licencia

[Especificar licencia si aplica]

