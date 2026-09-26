# Plan de Implementación: Restauración de Endpoint Bulk Update Status de Pedidos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restaurar el endpoint `POST /api/orders/bulk-update-status` (y su alias `POST /api/orders/bulk-product-status`) en el backend modular, el cual actualmente responde con `405 Method Not Allowed` debido a que la ruta colisiona con `api/orders/{id}` al no existir una acción POST específica. Esto permitirá que la transición de productos a "Reporte de fabricación" (`action: queue`) y demás acciones operativas funcionen correctamente.

**Architecture:**
1. **DTOs:** Agregar `BulkUpdateProductStatusItemDto`, `BulkUpdateProductStatusRequestDto`, `BulkUpdateProductStatusResponseDto` a `Ordina.Application.Orders`.
2. **Lógica de Agregación de Estados:** Crear `OrderStatusAggregation.cs` en `Ordina.Application.Orders` para calcular el estado global del pedido a partir del estado de sus productos (ej. `"Reporte de fabricación"`, `"Fabricándose"`, `"Validado"`, etc.).
3. **Servicio de Aplicación:** Implementar `BulkUpdateProductStatusAsync` en `IOrderCoreService` y `OrderCoreService`, soportando las 8 acciones operativas (`queue`, `start`, `mark_fabricated`, `refabrication`, `to_dispatch`, `to_delivered`, `to_store`, `to_manufacturing`), persistiendo cambios, recalculando estado global y emitiendo registros de auditoría.
4. **Controlador:** Exponer `[HttpPost("bulk-update-status")]` y `[HttpPost("bulk-product-status")]` en `OrdersController.cs`.
5. **Pruebas:** Unit tests en `Ordina.Api.Tests` (validando el endpoint y códigos HTTP) y en `Ordina.Application.Tests` (validando la lógica de transición y cálculo de estados).
6. **Despliegue y Verificación:** Compilación, ejecución de tests, empaquetado, despliegue a Raspberry Pi (`sa@127.0.0.1:9888`) y validación estricta vía terminal / `curl` (SIN interactuar con el navegador, según restricción expresa del usuario).

**Tech Stack:** .NET 10, C#, ASP.NET Core, MongoDB Driver, xUnit, Moq, Docker Compose.

## Global Constraints
- **NO PROBAR EN EL NAVEGADOR:** El usuario indicó expresamente: `(no pruebes esto en el navegador, lo pruebo yo)`. Todas las verificaciones se realizarán mediante tests unitarios y llamadas controladas de `curl` a la API.
- **NO HACER `git commit`:** Todos los cambios deben permanecer sin commitear en el worktree `refactor-modular-monolith`.

---

### Task 1: DTOs y OrderStatusAggregation en Application

**Files:**
- Modify: `Ordina.Backend/src/Application/Orders/DTOs.cs`
- Create: `Ordina.Backend/src/Application/Orders/OrderStatusAggregation.cs`
- Test: `Ordina.Backend/tests/Ordina.Application.Tests/OrderStatusAggregationTests.cs`

- [x] **Step 1: Escribir tests unitarios para `OrderStatusAggregation`**
- [x] **Step 2: Ejecutar el test para comprobar que falla (rojo)**
- [x] **Step 3: Agregar DTOs y `OrderStatusAggregation.cs`**
- [x] **Step 4: Ejecutar tests para comprobar que pasan (verde)**

---

### Task 2: Implementación en IOrderCoreService y OrderCoreService

**Files:**
- Modify: `Ordina.Backend/src/Application/Orders/IOrderCoreService.cs`
- Modify: `Ordina.Backend/src/Application/Orders/OrderCoreService.cs`
- Test: `Ordina.Backend/tests/Ordina.Application.Tests/BulkUpdateProductStatusServiceTests.cs`

- [x] **Step 1: Escribir test unitario para `BulkUpdateProductStatusAsync` probando la acción `queue` ("Reporte de fabricación")**
- [x] **Step 2: Ejecutar el test para comprobar que falla (rojo)**
- [x] **Step 3: Implementar `BulkUpdateProductStatusAsync` en `OrderCoreService`**
- [x] **Step 4: Ejecutar tests para comprobar que pasan (verde)**

---

### Task 3: Exponer Endpoints en OrdersController y Tests de Controlador

**Files:**
- Modify: `Ordina.Backend/src/Api/Controllers/OrdersController.cs`
- Test: `Ordina.Backend/tests/Ordina.Api.Tests/OrdersControllerTests.cs`

- [x] **Step 1: Escribir test unitario en `OrdersControllerTests` para `BulkUpdateProductStatus`**
- [x] **Step 2: Ejecutar el test para comprobar que falla (rojo)**
- [x] **Step 3: Agregar `[HttpPost("bulk-update-status")]` y `[HttpPost("bulk-product-status")]` a `OrdersController.cs`**
- [x] **Step 4: Ejecutar tests del controlador para comprobar que pasan (verde)**

---

### Task 4: Compilación Global y Despliegue en Raspberry Pi

**Commands:**
- `dotnet test tests/Ordina.Api.Tests`
- `dotnet test tests/Ordina.Application.Tests`
- Empaquetado `modular-backend.tar.gz`, transferencia a RPi (`sa@127.0.0.1:9888`), reconstrucción de imagen Docker y recreación de `modular-api`.

- [x] **Step 1: Ejecutar toda la suite de tests locales de backend**
- [x] **Step 2: Empaquetar y transferir a la Raspberry Pi**
- [x] **Step 3: Reconstruir y reiniciar `modular-api`**
- [x] **Step 4: Verificar vía `curl` en terminal que la ruta responde sin 405 Method Not Allowed (sin tocar el navegador)**
- [x] **Step 5: Notificar al usuario para que pruebe en el navegador**
