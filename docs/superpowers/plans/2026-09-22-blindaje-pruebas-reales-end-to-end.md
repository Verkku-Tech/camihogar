# Plan de Implementación: Blindaje y Pruebas Reales de Extremo a Extremo (Camihogar / Ordina)

**Fecha:** 2026-09-22  
**Especificación de Diseño:** [`docs/superpowers/specs/2026-09-22-blindaje-pruebas-reales-end-to-end-design.md`](file:///f:/Verkku/Camihogar/.worktrees/refactor-modular-monolith/docs/superpowers/specs/2026-09-22-blindaje-pruebas-reales-end-to-end-design.md)  
**Estrategia:** Despacho de Subagentes en Paralelo (Track A Backend + Track B Frontend) con Revisión Adversarial Pesimista y Convergencia en Track C (E2E & Estrés RPi 5).

---

## 1. Arquitectura de Ejecución y Paralelismo

```
[ ORQUESTADOR PRINCIPAL ]
   ├── TRACK A (En paralelo con Track B)
   │     ├── Subagente A1: Implementación Fase 1 (Backend Core & Configuración Real)
   │     ├── Subagente A2: Revisión Pesimista Fase 1 (Prueba de Mutación y Anti-Fallback)
   │     ├── Subagente A3: Implementación Fase 2 (MongoDB Real, Reglas de Negocio & RBAC)
   │     └── Subagente A4: Revisión Pesimista Fase 2 (Integridad en Base de Datos Real)
   │
   ├── TRACK B (En paralelo con Track A)
   │     ├── Subagente B1: Implementación Fase 3 (Frontend Core: Contextos, Auth & Divisas)
   │     ├── Subagente B2: Revisión Pesimista Fase 3 (JWT Expiración y Fallbacks BCV)
   │     ├── Subagente B3: Implementación Fase 4 (Filtros de Reportes y Formularios de Pedidos)
   │     ├── Subagente B4: Revisión Pesimista Fase 4 (Limpieza de Selecciones y Cálculos)
   │     ├── Subagente B5: Implementación Fase 5 (Resiliencia Offline, Outbox e IndexedDB)
   │     └── Subagente B6: Revisión Pesimista Fase 5 (Cortes de Red y Reconciliación IDs)
   │
   └── TRACK C (Convergencia tras aprobación de Track A y Track B)
         ├── Subagente C1: Implementación Fase 6 (Flujo E2E, Estrés en RPi 5 y Cloudflare)
         └── Subagente C2: Revisión Pesimista Fase 6 (P95 Latencia, Térmica y Seguridad WAF)
```

---

## 2. Desglose Detallado de Tareas por Track

### TRACK A: BACKEND & BASE DE DATOS REAL

#### Tarea A.1: Fase 1 - Configuración Real, Arranque y Contratos Base
* **Archivos a modificar/crear:**
  - [MODIFY] `Ordina.Backend/tests/Ordina.Api.Tests/DatabaseConfigurationAndConnectionTests.cs`:
    - Eliminar la cadena de fallback `?? "mongodb://localhost:27017/ordina_db"`.
    - Leer directamente el archivo físico `Ordina.Backend/src/Api/appsettings.Development.json` y `appsettings.json`.
    - Afirmar que las secciones `ConnectionStrings:MongoDB`, `Jwt:SecretKey` (>= 32 chars) y `Cors:AllowedOrigins` existan y tengan valores válidos.
  - [NEW] `Ordina.Backend/tests/Ordina.Api.Tests/DependencyInjectionValidationTests.cs`:
    - Construir el contenedor de DI con `ValidateScopes = true` y `ValidateOnBuild = true`.
    - Resolver `OrdersController`, `ProductsController`, `ClientsController`, `MongoDbContext`, `IOrderService`, etc.
  - [NEW] `Ordina.Backend/tests/Ordina.Api.Tests/MiddlewarePipelineTests.cs`:
    - Probar que `IdempotencyMiddleware` retorne respuestas cacheadas para `X-Mutation-Id` repetido.
    - Probar que `GlobalExceptionMiddleware` formatee excepciones en `ProblemDetails` RFC 7807 sin stacktrace sensible.
* **Comando de Verificación:** `dotnet test Ordina.Backend/tests/Ordina.Api.Tests`
* **Auditoría del Revisor Pesimista A.1:**
  - Mutación 1: Cambiar el nombre de la clave en `appsettings.Development.json` (`ConnectionStrings:MongoDB` -> `MongoDbConnection`). Confirmar que la prueba falle (RED).
  - Mutación 2: Comentar el registro de un servicio en `AddInfrastructure`. Confirmar que la prueba de DI falle (RED).

#### Tarea A.2: Fase 2 - Dominio, Servicios de Negocio y Base de Datos Real
* **Archivos a modificar/crear:**
  - [NEW] `Ordina.Backend/tests/Ordina.Application.Tests/MongoDatabaseRealIntegrationTests.cs`:
    - Conectar contra una base de datos real de prueba (ej. `ordina_test_db`).
    - Validar que los índices reales existan en las colecciones (índice único en `orderNumber`, índices en `status`, texto en `products`).
  - [NEW] `Ordina.Backend/tests/Ordina.Application.Tests/OrderStateMachineAndFinancialTests.cs`:
    - Probar transiciones de estado de órdenes (rechazo de transiciones inválidas: `Generado` -> `Entregado` sin despacho).
    - Probar pagos mixtos: Combinación de Divisas Efectivo + Pago Móvil Bs + Cashea con cálculo exacto a tasa BCV.
    - Validación de referencias bancarias duplicadas y conciliación de cuentas.
  - [NEW] `Ordina.Backend/tests/Ordina.Application.Tests/EndpointSecurityAndRbacTests.cs`:
    - Validar que endpoints administrativos rechacen tokens con rol `seller` (`403 Forbidden`).
* **Comando de Verificación:** `dotnet test Ordina.Backend/tests/Ordina.Application.Tests`
* **Auditoría del Revisor Pesimista A.2:**
  - Mutación 1: Permitir cancelar una orden en estado `Entregado`. Confirmar que la prueba de máquina de estados falle (RED).
  - Mutación 2: Registrar un pago con referencia bancaria duplicada. Confirmar que la prueba de anti-fraude falle (RED).

---

### TRACK B: FRONTEND, CONTEXTOS & RESILIENCIA PWA

#### Tarea B.1: Fase 3 - Estado, Autenticación y Contextos (Frontend Core)
* **Archivos a modificar/crear:**
  - [NEW] `Ordina.Frontend/src/contexts/__tests__/auth-context.test.ts`:
    - Restauración silenciosa de sesión desde cookies HttpOnly.
    - Expiración de sesión y periodo de gracia offline (1 hora).
    - Validación de `hasPermission(permission)` con matriz de roles y permisos.
    - Impersonación segura y limpieza en `logout`.
  - [NEW] `Ordina.Frontend/src/contexts/__tests__/currency-context.test.ts`:
    - Conversión multi-moneda con tasas BCV.
    - Manejo de fallback ordenado cuando no hay tasa BCV (`"(sin tasa BCV)"`).
  - [NEW] `Ordina.Frontend/src/contexts/__tests__/navigation-context.test.ts`:
    - Visibilidad por rol de usuario (`super_admin` vs `seller` vs `workshop`).
* **Comando de Verificación:** `bun test src/contexts/__tests__/`
* **Auditoría del Revisor Pesimista B.1:**
  - Mutación 1: Forzar que `hasPermission` devuelva `true` para cualquier rol. Confirmar que la prueba falle (RED).
  - Mutación 2: Pasar tasa BCV en 0. Confirmar que el test verifique el fallback controlado sin lanzar excepción no capturada.

#### Tarea B.2: Fase 4 - Flujos de Negocio, Formularios y Filtros (Frontend Slices)
* **Archivos a modificar/crear:**
  - [NEW] `Ordina.Frontend/src/components/reports/__tests__/payments-report-filters.test.ts`:
    - Carga de dataset masivo de pagos (100+ filas).
    - Filtrado combinado: rango de fechas + cuenta bancaria + forma de pago + estado de conciliación.
    - Certificar que `selectedRowIds` se limpie inmediatamente al alterar cualquier filtro.
  - [NEW] `Ordina.Frontend/src/components/reports/__tests__/manufacturing-report-filters.test.ts`:
    - Filtrado por estados (`debe_fabricar`, `por_fabricar`, `fabricando`, `almacen_no_fabricado`), taller y fechas.
    - Comprobar que no existan re-renders en cascada.
  - [NEW] `Ordina.Frontend/src/components/orders/__tests__/order-form-calculations.test.ts`:
    - Cálculo de subtotales, variantes de producto, pagos parciales y saldos adeudados.
* **Comando de Verificación:** `bun test src/components/`
* **Auditoría del Revisor Pesimista B.2:**
  - Mutación 1: Eliminar la limpieza de `selectedRowIds` al cambiar de filtro. Confirmar que la prueba detecte la persistencia de IDs huérfanos y falle (RED).

#### Tarea B.3: Fase 5 - Resiliencia Offline y PWA (Outbox & IndexedDB)
* **Archivos a modificar/crear:**
  - [NEW] `Ordina.Frontend/src/lib/__tests__/pwa-offline-resilience.test.ts`:
    - Simulación de caída de red (`Failed to fetch`, 502, 503, 504) -> Transición a `unreachable`.
    - Comprobar que error HTTP 500 **no** active el modo offline.
    - Creación offline de pedidos con ID temporal `ord_off_...`.
    - Drenado de cola outbox y **reconciliación de ID temporal por ID canónico del backend**.
  - [NEW] `Ordina.Frontend/src/lib/__tests__/service-worker-precache.test.ts`:
    - Validar que el manifest y los activos de producción figuren en la tabla de precache de Workbox.
* **Comando de Verificación:** `bun test src/lib/__tests__/`
* **Auditoría del Revisor Pesimista B.3:**
  - Mutación 1: Deshabilitar la sustitución del ID temporal tras el drenado del outbox. Confirmar que la prueba falle (RED).

---

### TRACK C: CONVERGENCIA, E2E, ESTRÉS EN RPI 5 & CLOUDFLARE

#### Tarea C.1: Fase 6 - E2E Maestro, Estrés Térmico y Cloudflare
*(Inicia únicamente tras la aprobación de Track A y Track B)*
* **Archivos a modificar/crear:**
  - [NEW] `scripts/e2e/master-order-flow.test.ts` (o suite E2E en Playwright/Bun):
    - Flujo completo: Login -> Crear Cliente -> Pedido con producto custom -> Abono parcial mixto -> Asignación de Taller -> Fabricación completa -> Pago final -> Asignación de Despacho y Entrega.
  - [NEW] `scripts/benchmarks/rpi5-stress-test.js` (Script k6 / bombardier):
    - Carga sostenida de 50 usuarios concurrentes durante 5 minutos.
    - Medición de P95 (< 250 ms) y tasa de error (< 0.1%).
    - Registro de telemetría de RPi 5: temperatura (`vcgencmd measure_temp`), estrangulamiento (`vcgencmd get_throttled`) y memoria RAM (dentro de 16 GB).
  - [NEW] `scripts/security/cloudflare-tunnel-audit.sh`:
    - Verificación del túnel TCP/HTTP `cloudflared` activo en producción.
    - Comprobación de cabeceras WAF y protección contra inyecciones.
* **Comandos de Verificación:**
  - `bun run test:e2e`
  - `k6 run scripts/benchmarks/rpi5-stress-test.js`
  - `bash scripts/security/cloudflare-tunnel-audit.sh`
* **Auditoría del Revisor Pesimista C.1:**
  - Verificar que si el backend excede 300 ms de latencia P95 o genera errores 500 bajo carga, la prueba de estrés falle (RED).
  - Verificar que las peticiones no autenticadas hacia endpoints administrativos por el túnel sean rechazadas.

---

## 3. Matriz de Definición de Terminado (Definition of Done)

Para considerar completado el plan de blindaje de pruebas:
1. **Track A (Backend):** 100% pruebas de `Ordina.Api.Tests` y `Ordina.Application.Tests` pasando con base de datos real, cero fallbacks y auditoría pesimista aprobada.
2. **Track B (Frontend):** 100% pruebas en `bun test` cubriendo Contextos, Reportes, Pedidos y Resiliencia PWA, con auditoría pesimista aprobada.
3. **Track C (Infraestructura y E2E):** Flujo E2E verde, benchmark k6 en RPi 5 con P95 < 250 ms y telemetría térmica dentro de rangos seguros (< 75°C, 0 throttling).
