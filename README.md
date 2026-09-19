# Camihogar / Ordina ERP — Monolito Modular Clean & SPA PWA

Sistema integral de gestión comercial, presupuestos, manufactura, despacho y finanzas para **Camihogar**, optimizado para despliegue en Raspberry Pi 5 y Cloudflare Pages.

---

## 🏛️ Arquitectura del Sistema

```
camihogar/
├── Ordina.Backend/                 # Monolito Modular Clean en .NET 10 (ReadyToRun ARM64)
│   ├── src/
│   │   ├── Domain/                 # Entidades de dominio, Enums tipados, Records BSON
│   │   ├── Application/            # Casos de uso modulares, DTOs inmutables, Interfaces
│   │   ├── Infrastructure/         # MongoDB (100% Cero SQL/EF/Redis), Caché, Índices
│   │   └── Api/                    # ASP.NET Core Web API, Middlewares, OpenTelemetry
│   ├── tests/
│   │   ├── Ordina.Application.Tests/ # Pruebas TDD de lógica de negocio y concurrencia
│   │   └── Ordina.Api.Tests/         # Pruebas de integración de Middlewares y Seguridad
│   └── Ordina.sln
│
├── Ordina.Frontend/                # SPA Estática en Bun + Vite + React 19 + TypeScript
│   ├── src/
│   │   ├── lib/                    # api-client (50 líneas), sync-manager FIFO, IndexedDB
│   │   ├── contexts/               # AuthContext con HttpOnly silent refresh y Anti-CSRF
│   │   ├── modules/                # Módulos por caso de uso (Orders, Mfg, Dispatch, Clients)
│   │   └── index.css               # Sistema de Diseño Verkku Precision Atelier
│   └── vite.config.ts              # Configuración Vite PWA y Service Worker offline
│
├── docker-compose.yml              # Despliegue de producción (MongoDB, Aspire, Backend, Frontend)
└── .github/workflows/
    └── deploy-rpi-prd.yml          # CI/CD multi-arch (ARM64/AMD64) con WireGuard SSH deploy
```

---

## 🚀 Inicio Rápido

### Prerrequisitos
- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Bun >= 1.2](https://bun.sh/)
- [Docker & Docker Compose](https://www.docker.com/) (para MongoDB local y Aspire Dashboard)

### 1. Iniciar Base de Datos y Telemetría
```bash
docker compose up -d mongodb aspire-dashboard
```
- MongoDB disponible en `localhost:27017`
- Aspire Dashboard en `http://localhost:18888` (Token: `Camihogar_Aspire_2026_x89aF72kQz!`)

### 2. Backend .NET 10
```bash
cd Ordina.Backend
dotnet restore
dotnet run --project src/Api/Ordina.Api.csproj
```
El API estará disponible en `http://localhost:5000` (o `http://localhost:8080`).

### 3. Frontend Bun + Vite
```bash
cd Ordina.Frontend
bun install
bun dev
```
La aplicación web estará disponible en `http://localhost:5173`.

---

## 🧪 Comandos de Verificación (TDD)

```bash
# Ejecutar todas las pruebas del Backend
dotnet test Ordina.Backend/tests/Ordina.Application.Tests
dotnet test Ordina.Backend/tests/Ordina.Api.Tests

# Probar y compilar el Frontend PWA
cd Ordina.Frontend
bun test
bun run build
```

---

## 🛡️ Características de Seguridad y Rendimiento
- **Anti-CSRF:** Cabecera `X-Requested-With: XMLHttpRequest` obligatoria para endpoints con cookies.
- **Tokens en Memoria:** Tokens JWT de acceso en memoria React; `refreshToken` exclusivamente en cookies `HttpOnly; SameSite=Strict`. Cero tokens sensibles en `localStorage`.
- **Idempotencia Distribuida:** Mutaciones (`POST`, `PUT`, `PATCH`, `DELETE`) envían `X-Mutation-Id: <UUIDv4>` almacenado en MongoDB con TTL de 24 horas.
- **Concurrencia Optimista:** Control de versiones con `expectedUpdatedAt` e `If-Match` para prevenir sobrescrituras simultáneas (retorna `409 Conflict`).
- **PWA Offline First:** 3 almacenes IndexedDB dedicados (`tanstack_cache`, `outbox_mutations`, `telemetry_buffer`) con sincronización automática FIFO al reconectar.
