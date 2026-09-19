# Spec de Diseño: Refactorización Integral a Monolito Modular Clean (.NET 10) & Frontend SPA (Vite + TanStack Query)

**Fecha:** 2026-09-18  
**Estado:** Aprobado para Planificación  
**Marca & Identidad:** Verkku Precision Atelier (Verkku Emerald Green `#1CB569`, Grafito Cálido `#111418`, Plus Jakarta Sans)  
**Objetivo:** Consolidar el backend de 29 proyectos de microservicios en un **Monolito Modular Clean (.NET 10)** con compilación ReadyToRun (ARM64), base de datos **100% MongoDB**, servicios especializados por módulo de negocio (Fabricación, Despachos, Ventas, etc.), y refactorizar el frontend a un **SPA con Bun + Vite + React 19 + TanStack Query**, blindado contra caídas de red/servidor (Cloudflare Pages + PWA Offline con IndexedDB).

---

## 1. Problemas Resueltos y Decisiones Fundamentales

1. **Eliminación de Overengineering y Contenedores Muertos:**
   - Se eliminan 25 proyectos `.csproj` redundantes, el proxy de Next.js, API Gateway y Aspire AppHost.
   - Se eliminan por completo **PostgreSQL, Supabase (Studio, Kong, GoTrue) y Redis** de Docker (ahorro de ~600-800 MB de RAM en la Raspberry Pi).
   - **Base de datos única:** Toda la persistencia opera de forma nativa y directa en **MongoDB**.
2. **Backend Orientado a Casos de Uso / Módulos:**
   - En lugar de un mega-servicio de órdenes genérico, se crean servicios y controladores dedicados por caso de uso (`ManufacturingController`, `DispatchController`, `OrdersController`, etc.) con DTOs especializados.
3. **Frontend Ultraligero y Rápido (Bun + Vite + React 19):**
   - Migración de Next.js a **Bun + Vite**: instalación de paquetes en 1s (`bun install`), build estático en 2 segundos (`bun run build`), tests en milisegundos (`bun test`) y cero necesidad de correr un servidor Node.js en producción.
   - Puede desplegarse en **Cloudflare Pages (100% Uptime, CDN global gratuito)**.
4. **PWA Offline Indestructible (Fin al "502 Bad Gateway"):**
   - El Service Worker intercepta respuestas de error `>= 500` de Cloudflare y sirve el App Shell desde caché local en milisegundos.
   - Sincronización bidireccional segura con IndexedDB vía `mutationId` (idempotencia) y control de concurrencia optimista (`updatedAt`).
5. **Seguridad Robusta (XSS + CSRF Immune):**
   - Tokens híbridos: `accessToken` vive en memoria de React (15 min); `refreshToken` viaja en Cookie `HttpOnly`, `Secure`, `SameSite=Strict`.
   - Protección anti-CSRF con cabecera personalizada en `/api/auth/refresh`.

---

## 2. Arquitectura del Backend (.NET 10 Modular Clean)

Compilado en modo **ReadyToRun (R2R)** sobre imagen Docker **Ubuntu Chiseled ARM64** (`mcr.microsoft.com/dotnet/aspnet:10.0-chiseled`):

```
Ordina.Backend/src/
├── Domain/                                 # Ordina.Domain.csproj (Cero dependencias externas)
│   ├── Security/                           # Role, Permission, RolePermission
│   ├── Users/                              # User, UserProfile, Client, Permissions constants
│   ├── Catalog/                            # Provider, Product, Category
│   ├── Orders/                             # Order, OrderItem, OrderHistory
│   ├── Manufacturing/                      # WorkOrder, ManufacturingStage, RefabricationRecord
│   ├── Dispatch/                           # DispatchRoute, DeliveryStatus, DispatchItem
│   ├── Finance/                            # Payment, PaymentMethod, ExchangeRate, Account
│   └── Stores/                             # Store
│
├── Application/                            # Ordina.Application.csproj (Casos de uso y contratos)
│   ├── Security/                           # DTOs, IAuthService, ITokenService
│   ├── Users/                              # DTOs, IUserService, IRoleService
│   ├── Clients/                            # DTOs, IClientService, RutValidator
│   ├── Catalog/                            # DTOs, IProductService, ICategoryService, IImportService
│   ├── Orders/                             # DTOs, IOrderCoreService (creación, edición, presupuestos)
│   ├── Manufacturing/                      # DTOs, IManufacturingService (cola de taller, avance, prioridades)
│   ├── Dispatch/                           # DTOs, IDispatchService (filtros de ruta, entregas, paginación)
│   ├── Finance/                            # DTOs, IPaymentService, IExchangeRateService, ICommissionService
│   ├── Reports/                            # DTOs, IMetricsService, ICommissionReportService
│   ├── Stores/                             # DTOs, IStoreService, IAccountService
│   └── Common/                             # IRepository<T>, Result<T>, PagedResult<T>
│
├── Infrastructure/                         # Ordina.Infrastructure.csproj (Persistencia e integraciones)
│   ├── Mongo/                              # MongoDbContext, Collections, IndexManager, Migrations
│   ├── Repositories/                       # OrderRepository, ProductRepository, ClientRepository, etc.
│   ├── Caching/                            # In-Memory Cache Service (.NET 10 IMemoryCache / HybridCache)
│   ├── Security/                           # PasswordHasher (BCrypt/Argon2), JwtTokenGenerator
│   └── Exporting/                          # ExcelExporter (ClosedXML), PdfGenerators
│
└── Api/                                    # Ordina.Api.csproj (Punto de entrada único HTTP)
    ├── Controllers/
    │   ├── AuthController.cs               # Login, Refresh (Cookie HttpOnly), Logout
    │   ├── UsersController.cs
    │   ├── ClientsController.cs
    │   ├── ProductsController.cs
    │   ├── OrdersController.cs             # Core de pedidos y presupuestos
    │   ├── ManufacturingController.cs      # Endpoints dedicados para taller
    │   ├── DispatchController.cs           # Endpoints dedicados para logística
    │   ├── FinanceController.cs            # Pagos, cuentas, tasas, comisiones
    │   ├── ReportsController.cs            # Métricas y reportes agregados
    │   └── StoresController.cs
    ├── Middleware/                         # GlobalExceptionHandler, SecurityHeadersMiddleware
    ├── Extensions/                         # AddApplicationServices(), AddInfrastructure()
    ├── Program.cs                          # Configuración centralizada de DI, CORS, Auth, Cache
    └── Dockerfile                          # Multi-stage build ARM64 con ReadyToRun
```

---

## 3. Arquitectura del Frontend (Vite + React 19 + TanStack Query + IndexedDB Optimizado)

```
Ordina.Frontend/
├── public/
│   ├── manifest.json
│   ├── icons/
│   └── sw.js                              # Service Worker con soporte offline robusto
├── src/
│   ├── main.tsx                           # Entry point con QueryClientProvider, RouterProvider
│   ├── lib/
│   │   ├── api-client.ts                  # Cliente Axios/Fetch tipado con interceptor de refresh
│   │   ├── query-client.ts                # TanStack QueryClient con persister automático a IndexedDB
│   │   ├── idb-storage.ts                 # Wrapper minimalista tipado de IndexedDB (idb)
│   │   ├── sync-manager.ts                # Gestor de Outbox Queue offline con deduplicación por mutationId
│   │   └── telemetry.ts                   # Ingesta y transporte de logs/errores hacia el backend/Aspire
│   ├── contexts/                          # AuthContext (token en memoria), ThemeContext
│   ├── modules/ (features)
│   │   ├── auth/                          # useAuth(), LoginForm, ProtectedRoute
│   │   ├── clientes/                      # useClients(), useClientSearch(), ClientTable
│   │   ├── catalogo/                      # useProducts(), useCategories(), ProductGrid
│   │   ├── pedidos/                       # useOrdersList(), useCreateOrder(), OrderDetail
│   │   ├── fabricacion/                   # useManufacturingQueue(), useUpdateStage(), WorkshopKanban
│   │   ├── despachos/                     # useDispatchList(), useMarkDelivered(), RoutePlanner
│   │   ├── finanzas/                      # useExchangeRates(), useAccounts(), PaymentModal
│   │   └── reportes/                      # useDashboardMetrics(), useCommissionReport()
│   ├── components/
│   │   ├── ui/                            # Botones, Modals, Inputs, Badges, Tabs (Radix + Tailwind)
│   │   ├── layout/                        # Sidebar con logo Verkku, Header con SyncBadge, Breadcrumbs
│   │   └── ErrorBoundary.tsx              # Captura global de errores React conectada a telemetría
│   └── routes/                            # React Router v7 / TanStack Router (rutas protegidas)
├── package.json                           # Scripts: dev, build, preview
├── tailwind.config.js                     # Paleta Verkku Precision Atelier
└── vite.config.ts                         # Configuración Vite + vite-plugin-pwa
```

### 3.1 Corrección de la Estrategia de IndexedDB (Modo Offline)

En lugar del esquema anterior (15 ObjectStores manuales replicando tablas que causaban desincronización y código espagueti), se establece un esquema limpio de **3 ObjectStores especializados**:

1. **`tanstack_cache` (Lecturas Offline Instantáneas):**
   - El plugin `@tanstack/react-query-persist-client` sincroniza automáticamente todo el caché de consultas en este store (`staleTime: 5 min`, `gcTime: 24h`).
   - Al abrir la app sin conexión, los datos de pedidos, clientes y catálogo se hidratan en memoria en `<10ms`.
2. **`outbox_mutations` (Escrituras Offline Seguras):**
   - Almacena mutaciones (`POST`, `PUT`, `PATCH`, `DELETE`) emitidas offline con:
     - `mutationId` (UUIDv4 para idempotencia en el backend).
     - `endpoint`, `method`, `payload`, `timestamp`, `retryCount`.
     - `status`: `pending` | `in_flight` | `failed`.
   - Al reconectar la red, `sync-manager.ts` drena la cola en orden FIFO enviando la cabecera `X-Mutation-Id: <uuid>`, actualizando el caché local e invalidando las queries afectadas.
3. **`telemetry_buffer` (Cola de Logs Offline):**
   - Si se producen errores de cliente o fallos de sincronización mientras no hay internet, se almacenan temporalmente aquí y se envían en lote al backend en cuanto se restablece la conexión.

---

## 4. Sistema de Diseño: "Verkku Precision Atelier"

El diseño visual de Camihogar está concebido bajo el concepto **"Verkku Precision Atelier"**, fusionando la elegancia del mobiliario artesanal de alta gama con la precisión y ergonomía de un software industrial moderno:

### 4.1 Paleta de Colores y Tokens de Diseño

```css
:root {
  /* Marca Primaria */
  --brand-emerald: #1CB569;
  --brand-emerald-hover: #179E5B;
  --brand-emerald-subtle: rgba(28, 181, 105, 0.12);

  /* Fondos y Superficies (Dark Mode por Defecto en Taller) */
  --bg-canvas: #111418;        /* Grafito Cálido Profundo */
  --bg-surface: #181D23;       /* Superficie de Tarjetas */
  --bg-surface-elevated: #202730; /* Modales y Dropdowns */
  --border-subtle: #2A3340;    /* Bordes de Contenedores */
  --border-strong: #3D4A5C;

  /* Texto y Jerarquía */
  --text-primary: #F3F4F6;
  --text-secondary: #9CA3AF;
  --text-muted: #6B7280;

  /* Acentos Semánticos de Negocio */
  --status-craft-amber: #D97706;    /* Fabricación / Corte / Armado / Tapicería */
  --status-dispatch-blue: #3B82F6;  /* En Ruta / Logística / Despacho */
  --status-danger-coral: #EF4444;   /* Refabricación / Alerta / Deuda Vencida */
  --status-ready-emerald: #1CB569;  /* Listo / Entregado / Pagado */
}
```

### 4.2 Tipografía y Jerarquía

* **Interfaz, Títulos y Botones:** `Plus Jakarta Sans` (400 Regular, 500 Medium, 600 SemiBold, 700 Bold).
* **Monedas (USD / VES), Códigos de Pedido, Dimensiones y Tasas:** `JetBrains Mono` (500 Medium) con `tabular-nums` para alineación vertical perfecta en columnas financieras.

### 4.3 Componentes y Ergonomía de Interfaz

1. **Tablero Kanban de Taller (Operarios & Tablets):**
   - Tarjetas de trabajo amplias con soporte táctil (mínimo 48px de área de pulsación).
   - Indicador visual prominente de la etapa actual (Corte ➔ Armado ➔ Tapicería ➔ Pintura ➔ Calidad ➔ Empacado).
   - Botón de acción rápida en un solo toque para avanzar etapa o reportar refabricación con `useOptimistic`.
2. **Tablas de Alta Densidad (Administración y Ventas):**
   - Encabezados pegajosos (*Sticky Headers*) con filtros server-side rápidos.
   - Paginador compacto con selector de tamaño de página (20, 50, 100).
3. **Indicador de Estado de Conexión (`SyncBadge`):**
   - Ubicado permanentemente en el Header superior con micro-animación:
     * 🟢 **En línea:** Verde Verkku sutil.
     * 🟡 **3 cambios pendientes:** Ámbar pulsante (drenando cola outbox).
     * 🔴 **Modo Offline:** Terracota no invasivo (App 100% funcional desde caché IndexedDB).

---

## 5. Observabilidad, Logging y Monitoreo (.NET Aspire Dashboard en Producción)

Para garantizar visibilidad total sin sobrecargar la Raspberry Pi 5 y unificar los logs del Frontend (Cloudflare) y Backend (.NET 10):

1. **.NET Aspire Standalone Dashboard en Producción:**
   - Contenedor dedicado `ordina-aspire-dashboard` corriendo en la red interna de Docker.
   - **Seguridad:** Protegido con `DASHBOARD__FRONTEND__AUTHMODE=BrowserToken` (`Camihogar_Aspire_2026_x89aF72kQz!`) y expuesto vía túnel Cloudflare para acceso administrativo protegido.
   - **Recepción OTLP:** Escuchando en el puerto `4317` (gRPC) con `DASHBOARD__OTLP__AUTHMODE=Unsecured` (restringido a la red interna `ordina-network`).

2. **OpenTelemetry Unificado en .NET 10 (`Ordina.Api`):**
   - Integración nativa de OpenTelemetry en `Program.cs` / `ServiceDefaults`:
     - **Structured Logging:** `IncludeFormattedMessage = true` y `IncludeScopes = true`. Enriquecimiento de logs con `_logger.BeginScope` (`Module`, `OrderId`, `OrderNumber`, `UserId`, `Action`).
     - **Traces:** Traza distribuida única por petición HTTP que abarca controlador -> servicios de aplicación -> consultas del driver de MongoDB.
     - **Métricas:** Consumo de memoria, CPU, tiempo de respuesta de endpoints (p50, p95, p99) y llamadas a la BD.

3. **Visualización Unificada de Logs del Frontend en Aspire Dashboard:**
   - A pesar de que el Frontend SPA corre en Cloudflare Pages / Navegadores clientes, sus logs se visualizan en **Aspire Dashboard**:
     - `src/lib/telemetry.ts` y `ErrorBoundary.tsx` capturan excepciones JS, errores de renderizado, lentitud de red y anomalías de sincronización offline.
     - Los eventos se envían vía `POST /api/telemetry/client-logs` a `Ordina.Api`.
     - El `TelemetryController` en .NET 10 crea un `Activity` de OpenTelemetry y registra el log estructurado con scope:
       ```csharp
       using (_logger.BeginScope(new Dictionary<string, object>
       {
           ["Source"] = "Frontend-SPA",
           ["Client.User"] = dto.Username ?? "Anonymous",
           ["Client.Route"] = dto.Route,
           ["Client.IsOnline"] = dto.IsOnline,
           ["Client.PendingQueue"] = dto.PendingMutationsCount,
           ["Client.UserAgent"] = dto.UserAgent
       }))
       {
           _logger.LogError(dto.Exception, "[SPA] {Message} en {Route}", dto.Message, dto.Route);
       }
       ```
     - En el Aspire Dashboard basta con filtrar por `Source == "Frontend-SPA"` para auditar problemas del frontend en tiempo real.

4. **Rotación y Retención de Logs de Docker:**
   - Prevención de saturación del almacenamiento NVMe/SD de la Raspberry Pi 5 configurando en `docker-compose.yml`:
     ```yaml
     logging:
       driver: "json-file"
       options:
         max-size: "50m"
         max-file: "3"
     ```

---

---

## 6. Estrategia de Pruebas TDD Pragmático (Flujos Reales vs Pruebas Triviales)

El desarrollo se rige por **TDD estricto enfocado en alto valor de negocio**. Cero pruebas superficiales de getters/setters o mocks vacíos; cada prueba debe validar un flujo real, transiciones de estado o condiciones de borde críticas:

1. **Flujo de Ciclo de Vida y Transiciones de Pedidos / Taller (`Orders & Manufacturing`):**
   - Validación de creación de `WorkOrder` a partir de un presupuesto aprobado.
   - Prohibición de saltos de etapa ilegales en fabricación (ej. pasar directo a *Empacado* sin pasar por *Control de Calidad*).
   - Bloqueo de despacho si existen registros de *Refabricación* activos.
2. **Cálculos Financieros, Tasas y Multi-Moneda (`Finance & Exchange Rates`):**
   - Verificación de precisión decimal en totales con descuentos globales, descuentos por ítem y sobreprecios de tapicería.
   - Aplicación exacta de tasas de cambio históricas vs vigentes (USD <-> VES).
   - Validación de pagos parciales: rechazo de pagos mayores al balance pendiente y actualización exacta del saldo deudor.
3. **Idempotencia y Manejo de Concurrencia (`Idempotency & Concurrency`):**
   - Reenvío de mutaciones offline con cabecera `X-Mutation-Id`: debe retornar `200 OK` con el resultado existente sin duplicar registros.
   - Concurrencia optimista (`updatedAt`): rechazo con `409 Conflict` si el documento fue modificado en el servidor mientras el cliente estaba offline.
4. **Seguridad y Control de Acceso (`Security & Permissions`):**
   - Bloqueo `403 Forbidden` a usuarios con rol *Taller* que intenten modificar precios de catálogo o cuentas de finanzas.
   - Rotación y validación de Refresh Token en Cookie `HttpOnly` con validación de cabecera Anti-CSRF.
5. **Frontend Offline & Outbox Sync (Vitest + MSW):**
   - Encolado de mutaciones en IndexedDB (`outbox_mutations`) en estado offline.
   - Drenaje secuencial al reconectar red, invalidación de queries en TanStack Query y persistencia del buffer de telemetría.

---

## 7. Seguridad, Resiliencia Operativa y Compatibilidad de Datos

1. **Topología de Cookies Cross-Origin y Protección Anti-CSRF:**
   - **Frontend:** `https://app.camihogar.com` (o `camihogar.pages.dev`).
   - **Backend:** `https://api.camihogar.com` (Cloudflare Tunnel hacia Raspberry Pi 5).
   - **Cookie `refreshToken`:** Configurada con `HttpOnly; Secure; SameSite=Lax` y `Domain=.camihogar.com` (o `SameSite=None; Secure` si eTLD difiere).
   - **Anti-CSRF:** El endpoint `/api/auth/refresh` exige la cabecera `X-Requested-With: OrdinaApp` o `X-CSRF-Token`.
   - **CORS Centralizado:** Configurado en `Program.cs` con `.AllowCredentials()` restringido a los orígenes autorizados.

2. **Rate Limiting Nativo en .NET 10 (Protección de Recursos RPi 5):**
   - Middleware `builder.Services.AddRateLimiter(...)`:
     * `/api/auth/login`: Límite estricto de 5 intentos/minuto por IP para prevenir ataques de fuerza bruta.
     * `/api/telemetry/client-logs`: Límite de 60 logs/minuto por cliente para prevenir saturación ante errores en bucle.

3. **Impresión de Fichas y Presupuestos (Zero-Server-Load):**
   - **Impresión Nativa en Frontend (`window.print()` + CSS `@media print`):** Formato pixel-perfect sin consumir memoria ni CPU en la Raspberry Pi 5 y sin dependencias C++ pesadas en contenedores Chiseled.
   - **Exportación Excel:** Mediante `ClosedXML` en .NET 10 (100% nativo C# sin dependencias de GDI+).

4. **Compatibilidad con Datos Heredados en MongoDB (`ConventionPack`):**
   - Registro de convención global `IgnoreExtraElementsConvention(true)` al arrancar `IndexManager`/`MongoDbContext` para garantizar que documentos antiguos con campos en desuso deserialicen sin excepciones.

5. **Actualización Automática de PWA (Cache Busting):**
   - Configuración de `vite-plugin-pwa` con `registerType: 'autoUpdate'`, `clientsClaim: true` y `skipWaiting: true` con hashing de bundle para que los clientes en taller reciban actualizaciones instantáneamente.

---

## 8. Estrategia de Implementación en Git Worktree

* **Rama:** `feat/modular-monolith-refactor`
* **Directorio de aislamiento:** `.worktrees/refactor-modular-monolith`
* **Despliegue & QA:**
  1. Compilación del backend en un único binario .NET 10 R2R.
  2. Ejecución de la suite de pruebas TDD de flujos reales (Backend xUnit + Frontend Bun test).
  3. Build de Vite y prueba de sincronización offline con corte simulado de red.
  4. Validación de recolección de trazas y logs en Aspire Dashboard en tiempo real.
  5. Validación de todos los flujos de negocio antes del merge definitivo a `main`.
