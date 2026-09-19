# Plan de Implementación: Monolito Modular Clean & Frontend Vite/React 19

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec Asociado:** `docs/superpowers/specs/2026-09-18-modular-monolith-spa-refactor-design.md`
**Objetivo:** Consolidar 29 proyectos en un Monolito Modular .NET 10 (R2R) con MongoDB puro, y migrar el frontend de Next.js a Bun + Vite + React 19 con soporte offline real.

**Reglas Críticas de `AGENTS.md` a cumplir en esta ejecución:**
1. **Target Framework:** `net10.0`.
2. **Anti-Hardcoding:** Estados y etapas deben ser Enums (ej. `OrderStatus.Pending`), NUNCA strings.
3. **Inmutabilidad:** Todos los DTOs deben ser `public record` o `public readonly record struct`.
4. **Resiliencia:** Uso estricto de `CancellationToken` propagado desde los Controladores hasta el driver de MongoDB.
5. **Base de Datos:** Inyección de `MongoClient` como `Singleton`. Cero uso de EF Core, Postgres o Redis.

---

## Task 1: Preparación del Repositorio (Git Worktree)

- [ ] **Step 1: Crear worktree para aislamiento**
```bash
git worktree add .worktrees/refactor-modular-monolith -b feat/modular-monolith-refactor
cd .worktrees/refactor-modular-monolith
```

---

## Task 2: Consolidación del Backend — Capa Domain

- [ ] **Step 1: Crear `Ordina.Domain.csproj` (Target: .NET 10)**
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="MongoDB.Bson" Version="3.5.0" />
  </ItemGroup>
</Project>
```

- [ ] **Step 2: Mover y refactorizar entidades de negocio**
  - Consolidar entidades de todos los dominios (`Security`, `Users`, `Catalog`, `Orders`, `Manufacturing`, `Dispatch`, `Finance`, `Stores`).
  - **REGLA:** Refactorizar propiedades de estado (ej. `public string Status { get; set; } = "Pending";`) para usar Enums fuertemente tipados (`OrderStatus`, `ManufacturingStage`, `PaymentStatus`).

---

## Task 3: Consolidación del Backend — Capa Application

- [ ] **Step 1: Crear `Ordina.Application.csproj`**
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="..\Domain\Ordina.Domain.csproj" />
    <PackageReference Include="Microsoft.Extensions.Caching.Memory" Version="10.0.0" />
  </ItemGroup>
</Project>
```

- [ ] **Step 2: Mover Interfaces de Repositorios**
  - Asegurar que TODOS los métodos `Async` incluyan `CancellationToken cancellationToken = default`.
- [ ] **Step 3: Mover y refactorizar DTOs**
  - **REGLA:** Convertir TODAS las clases de DTO (`public class OrderDto`) a `public record OrderDto(...)`.
- [ ] **Step 4: Mover y refactorizar Servicios (Casos de Uso)**
  - Implementar la propagación de `CancellationToken` en todas las llamadas internas.
  - Asegurar la compatibilidad de paginación (`PagedRequest`, `PagedResult<T>`).
- [ ] **Step 5: Definir estrategia de `IMemoryCache` por servicio**
  - Identificar los datos cacheables: catálogo de productos, categorías, tasas de cambio del día, tiendas y cuentas.
  - Definir TTLs por caso de uso: catálogo/categorías (`SlidingExpiration: 10 min`), tasas de cambio (`AbsoluteExpiration: 1 hora`), configuraciones (`AbsoluteExpiration: 30 min`).
  - Implementar invalidación explícita del caché al crear/actualizar/eliminar entidades cacheadas.

---

## Task 4: Consolidación del Backend — Capa Infrastructure

- [ ] **Step 1: Crear `Ordina.Infrastructure.csproj`**
  - Referenciar `MongoDB.Driver` (Cero EF Core, Postgres o Npgsql).
- [ ] **Step 2: Implementar Repositorios Mongo con Concurrencia Optimista**
  - Pasar el `CancellationToken` a todas las operaciones `Find`, `InsertOneAsync`, `UpdateOneAsync`.
  - **SEGURIDAD:** En las operaciones de actualización, usar filtro compuesto `{ _id: id, updatedAt: expectedUpdatedAt }`. Si `ModifiedCount == 0`, lanzar una excepción de conflicto que el controlador traduzca a `409 Conflict`.
  - Esto previene que dos usuarios (o un sync offline y un usuario online) sobreescriban cambios del otro sin saberlo.
- [ ] **Step 3: Configurar Autenticación JWT Híbrida (HttpOnly Cookie)**
  - **PasswordHasher:** BCrypt para hashing de contraseñas.
  - **Access Token (15 min):** JWT firmado que el backend retorna en el body JSON del login. El frontend lo almacena **únicamente en memoria de React** (variable de estado en `AuthContext`). Nunca toca `localStorage`.
  - **Refresh Token (7 días):** El backend lo emite como `Set-Cookie` con flags:
    ```
    Set-Cookie: refreshToken=<token>; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Domain=.camihogar.com; Max-Age=604800
    ```
  - **Endpoint `/api/auth/refresh`:** Lee el refresh token desde `Request.Cookies["refreshToken"]` (no del body). Valida la cabecera anti-CSRF `X-Requested-With: OrdinaApp`. Retorna nuevo access token en el body y rota el refresh token en una nueva cookie.
  - **Endpoint `/api/auth/logout`:** Invalida el refresh token en MongoDB y envía `Set-Cookie` con `Max-Age=0` para eliminar la cookie del navegador.
- [ ] **Step 4: Implementar Middleware de Idempotencia (`X-Mutation-Id`)**
  - Crear una colección `idempotency_keys` en MongoDB con campos: `{ mutationId, httpMethod, endpoint, responseStatusCode, responseBody, createdAt }` y un índice TTL (`createdAt`, expira en 24h).
  - El middleware (o `ActionFilter`) intercepta peticiones `POST/PUT/PATCH/DELETE` que lleven la cabecera `X-Mutation-Id`:
    1. Busca en `idempotency_keys` por `mutationId`.
    2. Si existe → retorna la respuesta almacenada (status code + body) sin ejecutar el controlador.
    3. Si no existe → ejecuta el controlador, almacena la respuesta en `idempotency_keys`, retorna al cliente.
  - Esto es la pieza central que previene duplicación de pedidos, pagos y clientes cuando el Sync Manager offline reintenta mutaciones.
- [ ] **Step 5: Inicialización de Índices y Seeders (MongoDB)**
  - Asegurar la creación de índices al arrancar la aplicación (ej. índices únicos para Email/RUT, índice TTL para `idempotency_keys`).
  - Configurar la inyección del usuario Administrador por defecto si la base de datos está vacía.
- [ ] **Step 6: Eliminar código muerto**
  - No copiar nada relacionado a Entity Framework, Supabase o DbContexts de SQL.

---

## Task 5: Consolidación del Backend — Capa Api (Punto de entrada único)

- [ ] **Step 1: Crear `Ordina.Api.csproj`**
```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <PublishReadyToRun>true</PublishReadyToRun>
  </PropertyGroup>
</Project>
```

- [ ] **Step 2: Configurar `Program.cs`**
  - **REGLA:** Registrar MongoDB correctamente: `builder.Services.AddSingleton<IMongoClient>(new MongoClient(connString));`
  - Configurar OpenTelemetry (traces, logs, métricas) con exportador OTLP hacia Aspire Dashboard (`http://aspire-dashboard:4317`).
  - Configurar CORS con `.AllowCredentials()` restringido a los orígenes autorizados.
  - Configurar compresión HTTP:
    ```csharp
    builder.Services.AddResponseCompression(opts => {
        opts.EnableForHttps = true;
        opts.Providers.Add<BrotliCompressionProvider>();
        opts.Providers.Add<GzipCompressionProvider>();
    });
    builder.Services.Configure<BrotliCompressionProviderOptions>(opts => opts.Level = CompressionLevel.Optimal);
    ```
  - Configurar Rate Limiting nativo con políticas por endpoint:
    ```csharp
    builder.Services.AddRateLimiter(opts => {
        opts.AddFixedWindowLimiter("auth", o => { o.PermitLimit = 5; o.Window = TimeSpan.FromMinutes(1); });
        opts.AddFixedWindowLimiter("telemetry", o => { o.PermitLimit = 60; o.Window = TimeSpan.FromMinutes(1); });
        opts.RejectionStatusCode = 429;
    });
    ```
    Aplicar en controladores: `[EnableRateLimiting("auth")]` en `AuthController.Login`, `[EnableRateLimiting("telemetry")]` en `TelemetryController`.

- [ ] **Step 3: Crear `SecurityHeadersMiddleware`**
  - Middleware que inyecte en cada respuesta HTTP:
    ```
    X-Content-Type-Options: nosniff
    X-Frame-Options: DENY
    Referrer-Policy: strict-origin-when-cross-origin
    Permissions-Policy: camera=(), microphone=(), geolocation=()
    Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:;
    ```
  - Registrar en `Program.cs` antes de `UseRouting()`.

- [ ] **Step 4: Refactorización de Controladores**
  - No copiar `OrdersController` gigante tal cual. Separar la lógica en `ManufacturingController`, `DispatchController`, `OrdersController`.
  - Crear `TelemetryController` con endpoint `POST /api/telemetry/client-logs` para recibir logs del frontend SPA.
  - Asegurar que cada endpoint reciba un `CancellationToken`.

- [ ] **Step 5: Crear Dockerfile multi-stage (Chiseled ARM64)**
  ```dockerfile
  FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
  WORKDIR /src
  COPY src/Domain/*.csproj Domain/
  COPY src/Application/*.csproj Application/
  COPY src/Infrastructure/*.csproj Infrastructure/
  COPY src/Api/*.csproj Api/
  RUN dotnet restore Api/Ordina.Api.csproj -r linux-arm64
  COPY src/ .
  RUN dotnet publish Api/Ordina.Api.csproj -c Release -r linux-arm64 \
      --no-restore --self-contained false \
      -p:PublishReadyToRun=true \
      -o /app/publish

  FROM mcr.microsoft.com/dotnet/aspnet:10.0-chiseled-arm64 AS final
  WORKDIR /app
  COPY --from=build /app/publish .
  EXPOSE 5000
  ENV ASPNETCORE_URLS=http://+:5000
  ENTRYPOINT ["dotnet", "Ordina.Api.dll"]
  ```

---

## Task 6: TDD Checkpoint — Pruebas Backend

- [ ] **Step 1: Unificar proyecto de pruebas `Ordina.Application.Tests`**
- [ ] **Step 2: Actualizar namespaces y mocks**
- [ ] **Step 3: Agregar pruebas de seguridad y concurrencia**
  - Test: Reenvío de mutación con `X-Mutation-Id` duplicado → debe retornar `200 OK` sin duplicar registro.
  - Test: Actualización con `updatedAt` obsoleto → debe retornar `409 Conflict`.
  - Test: Acceso de rol *Taller* a endpoint de finanzas → debe retornar `403 Forbidden`.
  - Test: Refresh token sin cabecera `X-Requested-With` → debe retornar `403 Forbidden`.
- [ ] **Step 4: Verificar flujo completo TDD (Red-Green-Refactor)**
  - Comprobar dependencias inyectadas correctamente.
  - Comprobar que compila (`dotnet build`) y pasan los tests (`dotnet test`).

---

## Task 7: Migración del Frontend a Bun + Vite + React 19

- [ ] **Step 1: Respaldar lógica valiosa y eliminar proyecto Next.js viejo**
```bash
# Renombrar para no perder hooks o componentes UI mientras migramos
mv Ordina.Frontend Ordina.Frontend_OLD
```

- [ ] **Step 2: Inicializar Vite con Bun**
```bash
bun create vite Ordina.Frontend --template react-ts
cd Ordina.Frontend
bun install
bun add @tanstack/react-query @tanstack/react-query-persist-client idb tailwindcss lucide-react react-router
bun add -d vite-plugin-pwa
```

- [ ] **Step 3: Configurar Variables de Entorno (`.env`)**
  - Crear `.env` y `.env.example` con `VITE_API_URL`.
  - Configurar `api-client.ts` para que lea de `import.meta.env.VITE_API_URL`.

- [ ] **Step 4: Descomponer `api-client.ts` (2785 líneas → módulos)**
  - El `api-client.ts` monolítico actual contiene ~50 DTOs, ~80 métodos de API, lógica de routing a 6 microservicios, caché manual de IndexedDB y cola de sincronización. **Debe desaparecer por completo.**
  - Mover los DTOs/tipos a archivos por módulo: `modules/pedidos/types.ts`, `modules/clientes/types.ts`, etc.
  - Reemplazar los ~80 métodos wrapper por hooks de TanStack Query (`useQuery`, `useMutation`) dentro de cada módulo: `modules/pedidos/hooks/useOrders.ts`, etc.
  - Crear un único `lib/api-client.ts` minimalista (~50 líneas) que sea un wrapper de `fetch` tipado con:
    - Base URL desde `import.meta.env.VITE_API_URL`.
    - Interceptor que inyecte `Authorization: Bearer <token>` desde el estado en memoria de `AuthContext`.
    - Interceptor que inyecte `X-Mutation-Id: <uuid>` en mutaciones (`POST/PUT/PATCH/DELETE`).
    - Interceptor que detecte `401` y llame a `/api/auth/refresh` (con `credentials: 'include'` para enviar la cookie).
  - Eliminar por completo la lógica de routing por servicio (`getBaseUrl` con switch de 6 microservicios).
  - Eliminar por completo la lógica de caché manual (`getFromCache`, `cacheResponse`) — TanStack Query + persister se encarga.

- [ ] **Step 5: Refactorizar `AuthContext` (Seguridad de Tokens)**
  - **Eliminar TODO uso de `localStorage`** para tokens (`auth_token`, `refresh_token`, `token_expires_at`, `refresh_token_expires_at`).
  - El `accessToken` vive en una variable de estado (`useState`) dentro del `AuthContext`. Se pierde al refrescar la pestaña (es el diseño correcto).
  - Al montar la app, hacer un `GET /api/auth/me` con `credentials: 'include'`. Si la cookie `refreshToken` sigue válida, el backend retorna un nuevo `accessToken` + datos del usuario. Si no, redirigir a login.
  - La función `login()` recibe el `accessToken` del body del response y lo guarda en estado. El `refreshToken` lo maneja el navegador automáticamente vía la cookie `Set-Cookie` del backend.
  - El `logout()` llama a `POST /api/auth/logout` con `credentials: 'include'` para que el backend invalide la cookie.
  - Se puede guardar `user_data` en `localStorage` (no es secreto), pero NUNCA tokens.

- [ ] **Step 6: Migrar UI Componentes**
  - Refactorizar el uso de `forwardRef` a pasar `ref` como prop directa (React 19).
  - Usar `useActionState` para formularios en lugar de estados de carga manuales.
  - Usar `useOptimistic` para acciones rápidas del Kanban de taller.

- [ ] **Step 7: Eliminar IndexedDB manual (15 stores → 3 stores)**
  - Eliminar `lib/indexeddb.ts` y los 15 ObjectStores manuales (`orders`, `categories`, `products`, `clients`, `providers`, `stores`, `accounts`, `sync_queue`, `api_cache`, `exchange_rates`, `commissions`, `product_commissions`, `sale_type_rules`, `app_config`, `dashboard_cache`).
  - Crear `lib/idb-storage.ts` con solo 3 ObjectStores especializados:
    1. **`tanstack_cache`:** Persistencia automática de TanStack Query vía `@tanstack/react-query-persist-client` + `createSyncStoragePersister` o persister IDB. Config: `staleTime: 5 min`, `gcTime: 24h`.
    2. **`outbox_mutations`:** Cola de mutaciones offline con campos `{ mutationId (UUIDv4), endpoint, method, payload, timestamp, retryCount, status }`.
    3. **`telemetry_buffer`:** Cola de logs/errores de cliente para enviar en lote al backend al reconectar.

- [ ] **Step 8: Reescribir Sync Manager con `mutationId` real**
  - Eliminar `lib/sync-manager.ts` actual (no envía `X-Mutation-Id`, IDs generados con `Date.now()`, no garantiza FIFO, usa `any`).
  - Crear nuevo `lib/sync-manager.ts`:
    1. Al encolar una mutación: generar `crypto.randomUUID()` y almacenar como `mutationId` en el store `outbox_mutations`.
    2. Al drenar la cola (reconexión): procesar en orden FIFO estricto (por `timestamp`).
    3. Cada petición enviada incluye la cabecera `X-Mutation-Id: <uuid>`.
    4. Si el backend retorna `200 OK` (idempotencia: ya procesado) → marcar como completada sin error.
    5. Si retorna `409 Conflict` (concurrencia) → marcar como fallida con mensaje descriptivo para el usuario.
    6. Tras cada sync exitoso, invalidar las queries afectadas en TanStack Query (`queryClient.invalidateQueries`).

- [ ] **Step 9: Configurar Service Worker con `vite-plugin-pwa`**
  - Eliminar `public/sw.js` manual y `public/sw.template.js` (atados a Next.js, no interceptan errores `>= 500`).
  - Configurar `vite-plugin-pwa` en `vite.config.ts`:
    ```typescript
    import { VitePWA } from 'vite-plugin-pwa';
    export default defineConfig({
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          workbox: {
            clientsClaim: true,
            skipWaiting: true,
            navigateFallback: '/index.html',
            runtimeCaching: [
              {
                urlPattern: /\/api\//,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'api-cache',
                  networkTimeoutSeconds: 5,
                  plugins: [{ /* plugin que intercepte status >= 500 y sirva desde caché */ }]
                }
              }
            ]
          },
          manifest: {
            name: 'Camihogar - Verkku Precision Atelier',
            short_name: 'Camihogar',
            theme_color: '#1CB569',
            background_color: '#111418',
            display: 'standalone',
          }
        })
      ]
    });
    ```
  - **Interceptación de errores `>= 500`:** Configurar un plugin de Workbox (`handlerDidError` o custom `fetchDidSucceed`) que, al recibir un response con status `>= 500` (ej. 502 Bad Gateway de Cloudflare), sirva el App Shell (`/index.html`) desde caché en lugar de mostrar la página de error de Cloudflare. TanStack Query en el cliente mostrará los datos de IndexedDB.
  - Precaching automático de todos los bundles de Vite (JS, CSS) con hashing de contenido.

---

## Task 8: Docker Compose, CI/CD y Despliegue

- [ ] **Step 1: Actualizar `docker-compose.yml`**
  - Mantener SOLO: `backend-api` (monolito R2R), `mongodb` puro, y `aspire-dashboard` (producción).
  - Eliminar por completo: `apigateway`, `security-api`, `users-api`, `providers-api`, `orders-api`, `payments-api`, `stores-api`, `frontend` (se despliega en Cloudflare Pages).
  - Agregar rotación de logs en todos los servicios:
    ```yaml
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "3"
    ```

- [ ] **Step 2: Reescribir workflow de GitHub Actions (`deploy-rpi-prd.yml`)**
  - El workflow actual detecta cambios por 7 servicios, construye 7 imágenes Docker con matriz, y despliega 7 contenedores. **Reescribir completamente:**
    - **Backend:** Un solo `docker build` del monolito → `docker push` → SSH al RPi → `docker compose pull && docker compose up -d backend-api`.
    - **Frontend:** `bun run build` → deploy a Cloudflare Pages (vía `wrangler pages deploy` o integración nativa de Cloudflare).
  - Eliminar la detección de cambios por servicio (`dorny/paths-filter` con 7 filtros).

- [ ] **Step 3: Validar Despliegue Local**
```bash
docker-compose up --build -d
```
  - Verificar que el consumo de memoria total del sistema se reduzca al mínimo esperado.
  - Verificar que las cabeceras de seguridad están presentes (`curl -I`).
  - Verificar que Rate Limiting funciona (`ab -n 10 -c 5` al login endpoint).

---

## Task 9: Limpieza de Residuos

- [ ] **Step 1: Eliminar proyectos antiguos del monorepo**
  - Eliminar los proyectos viejos de microservicios (`src/Application/Security/`, `Users/`, etc.).
  - Eliminar `src/Presentation/Ordina.ApiGateway/` y `src/Presentation/Ordina.AppHost/`.
  - Eliminar `src/Infrastructure/Ordina.Database/` y `src/Infrastructure/Ordina.ServiceDefaults/`.
  - Eliminar `Ordina.Frontend_OLD`.
- [ ] **Step 2: Actualizar `Ordina.sln`**
  - Referenciar solo los 4 proyectos nuevos (`Domain`, `Application`, `Infrastructure`, `Api`) + tests.
- [ ] **Step 3: Actualizar `AGENTS.md` y `README.md`**
  - Eliminar toda referencia a microservicios, Supabase, PostgreSQL, Redis, API Gateway y Next.js.
- [ ] **Step 4: Final Commit y Merge**
```bash
git add .
git commit -m "feat(arch): refactor integral a monolito .net 10 y frontend vite react 19"
```
