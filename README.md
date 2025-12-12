# Camihogar Monorepo

Monorepo para la aplicación Camihogar que contiene el frontend (Next.js) y el backend (.NET).

## 📁 Estructura del Proyecto

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

Ambos proyectos tienen configuración Docker:

- Frontend: `Ordina.Frontend/Dockerfile`
- Backend: `Ordina.Backend/`
- Unificado: `docker-compose.yml` (raíz del proyecto)

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

