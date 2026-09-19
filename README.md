# Camihogar / Ordina ERP — Plataforma de Gestión Integral

Plataforma empresarial de alto rendimiento diseñada específicamente para **Camihogar**, cubriendo la gestión integral del ciclo de vida comercial: presupuestos, ventas omnicanal, fabricación a medida en taller, logística de despachos y administración financiera bimonetaria (USD / Bs.).

El sistema está concebido bajo una premisa de **resiliencia operativa extrema**, garantizando continuidad de trabajo aun en condiciones de conectividad inestable o caídas de energía gracias a una arquitectura híbrida de **Monolito Modular en .NET 10**, **persistencia nativa 100% en MongoDB** y un **Frontend SPA PWA Offline-First en Bun + Vite + React 19**.

---

## 🏛️ Visión Conceptual de la Infraestructura

```
                                    🌐 CLIENTES & USUARIOS
                                  (Laptops, Tablets, Móviles)
                                              │
                     ┌────────────────────────┴────────────────────────┐
                     │                                                 │
          [ Conexión Online ]                                [ Caída de Red / Offline ]
                     ▼                                                 ▼
        Cloudflare Pages (Edge CDN)                         App Shell en Cache PWA
         SPA Estática (Bun + Vite)                        3 Almacenes IndexedDB Locales
                     │                                   (tanstack_cache / outbox / logs)
                     │ (WireGuard / Cloudflare Tunnel)                 │
                     ▼                                                 │ (Al reconectar)
          Raspberry Pi 5 (Host Local)                                  │ Reintento FIFO
   ┌──────────────────────────────────────────────┐                    │
   │  Docker Engine                               │ ◄──────────────────┘
   │                                              │
   │  ├── Backend (.NET 10 ReadyToRun ARM64)      │
   │  │   └── Monolito Modular Clean              │
   │  │                                           │
   │  ├── Base de Datos (MongoDB 7+)              │
   │  │   └── Persistencia 100% Nativa            │
   │  │                                           │
   │  └── Observabilidad (.NET Aspire Dashboard)  │
   │      └── Telemetría OTLP unificada (:18888)  │
   └──────────────────────────────────────────────┘
```

### 1. Despliegue Híbrido Edge & On-Premise
- **Servidor Local (Raspberry Pi 5 - 8 GB RAM):** Aloja el núcleo transaccional en un entorno de muy bajo consumo eléctrico (~5-12W). El backend se ejecuta sobre contenedores optimizados con **Ubuntu Chiseled** y compilación **ReadyToRun (R2R)**, logrando arranques instantáneos y consumos de memoria mínimos (< 120 MB).
- **Frontend en el Edge (Cloudflare Pages):** La aplicación cliente se sirve desde más de 300 puntos de presencia global con 100% de tiempo de actividad y latencia despreciable, sin requerir ningún servidor Node.js en producción.
- **Canal Seguro:** La comunicación entre Cloudflare Pages y el servidor local se realiza mediante un túnel cifrado (WireGuard o Cloudflare Tunnel), eliminando la necesidad de abrir puertos o exponer IPs públicas directamente a internet.

### 2. Persistencia 100% MongoDB (Cero Dependencias Relacionales ni Redis)
- Se eliminaron por completo las dependencias de PostgreSQL, Supabase y Redis, consolidando **toda la persistencia de forma nativa en MongoDB**.
- Esto simplifica la operación, reduce la huella de memoria RAM en ~700 MB y aprovecha la flexibilidad del modelo de documentos para pedidos que combinan pagos mixtos, tasas históricas y seguimiento de productos en confección.

### 3. Observabilidad Unificada con .NET Aspire Dashboard
- Un único contenedor standalone de **.NET Aspire Dashboard** (`http://localhost:18888`) centraliza trazas distribuidas, métricas de rendimiento y logs estructurados del Backend, complementado con la ingesta de errores del Frontend reportados vía `/api/telemetry/client-logs`.

---

## 💼 Módulos de Negocio

| Módulo | Alcance y Responsabilidad |
| :--- | :--- |
| **🛍️ Ventas & Pedidos** | Facturación directa, presupuestos, reservas y sistemas de apartado con conversión bimonetaria instantánea y soporte de tasas históricas. |
| **🔨 Taller & Manufactura** | Tablero de producción por etapas (Corte, Armado, Tapicería, Acabado), órdenes de trabajo y gestión de devoluciones por refabricación. |
| **🚚 Bodega & Despacho** | Control de stock final, planificación de rutas de entrega, inspección de calidad y confirmación de entrega al cliente. |
| **💵 Finanzas & Cobranzas** | Abonos parciales y combinados, control de apartados vencidos (> 90 días), integración con tasas BCV y arqueo de caja. |
| **👥 Clientes & Catálogo** | Directorio centralizado de clientes con validación de RUT/cédula venezolana, gestión de productos, categorías y proveedores. |
| **🐍 Scrappers & Migración** | Procesos automatizados en Python para extraer datos maestros y ventas del sistema legacy Abbaco hacia fuentes estructuradas. |

---

## 📚 Índice de Documentación del Repositorio

Para consultar los detalles técnicos, guías de implementación y estándares de cada subsistema, revisa los documentos dedicados:

### Componentes de Software
- 🖥️ **[Ordina.Backend/README.md](file:///F:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/Ordina.Backend/README.md):** Manual técnico del Monolito Modular en .NET 10, capas de Clean Architecture, inyección de MongoDB, middlewares de seguridad (Idempotencia, Anti-CSRF, Concurrencia Optimista) y suite de pruebas TDD.
- 🌐 **[Ordina.Frontend/README.md](file:///F:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/Ordina.Frontend/README.md):** Especificación del cliente SPA en Bun + Vite + React 19, Service Worker resiliente ante errores de Cloudflare, los 3 almacenes de IndexedDB y el sistema de diseño Verkku Precision Atelier.
- 🐍 **[Ordina.Scrappers/README.md](file:///F:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/Ordina.Scrappers/README.md):** Guía de ejecución y requisitos de los scripts de extracción y transformación de datos legacy desde SysAbbaco.

### Estándares y Especificaciones
- 📋 **[AGENTS.md](file:///F:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/AGENTS.md):** Manual maestro de ingeniería y directrices para agentes de IA y desarrolladores, con directrices modulares en `.agents/rules/`.
- 📐 **[Spec de Diseño del Refactor](file:///F:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/docs/superpowers/specs/2026-09-18-modular-monolith-spa-refactor-design.md):** Especificación técnica aprobada que define la consolidación hacia el monolito modular y la SPA estática.
- 📝 **[Plan de Implementación del Refactor](file:///F:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/docs/superpowers/plans/2026-09-18-modular-monolith-spa-refactor-plan.md):** Plan paso a paso con criterios de verificación y cobertura TDD.
- 📊 **[Guía de Métricas en MongoDB (mongosh)](file:///F:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/docs/Queries/dashboard-metrics-queries.md):** Scripts para auditar y verificar directamente en consola las 7 métricas clave del Dashboard de administración.

---

## 🚀 Inicio Rápido en Desarrollo Local

### 1. Levantar Base de Datos y Telemetría
```bash
# Inicia MongoDB (puerto 27017) y Aspire Dashboard (puerto 18888)
docker compose up -d mongodb aspire-dashboard
```
- MongoDB disponible en `mongodb://localhost:27017/ordina_db`
- Aspire Dashboard en `http://localhost:18888` (Token: `Camihogar_Aspire_2026_x89aF72kQz!`)

### 2. Iniciar el Backend (.NET 10)
```bash
cd Ordina.Backend
dotnet run --project src/Api/Ordina.Api.csproj
```
El API iniciará en `http://localhost:5000` con Swagger UI en `http://localhost:5000/swagger`.

### 3. Iniciar el Frontend (Bun + Vite)
```bash
cd Ordina.Frontend
bun install
bun dev
```
La aplicación web estará disponible en `http://localhost:5173`.

---

## 🧪 Comandos Esenciales de Verificación (TDD)

```bash
# Backend: Ejecutar pruebas unitarias y de integración
dotnet test Ordina.Backend/tests/Ordina.Application.Tests
dotnet test Ordina.Backend/tests/Ordina.Api.Tests

# Frontend: Probar, verificar tipos y compilar bundle de producción
cd Ordina.Frontend
bun test
bun run typecheck
bun run build
```
