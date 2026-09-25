# Cierre Operativo Fase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el cierre operativo integral de la Fase 2 de CamiHogar: conexión directa del ciclo Reserva ➡️ Pedido con deducción atómica de stock físico, módulo de transferencias/traspasos entre sedes y almacenes con estado en tránsito, órdenes de fabricación interna para stock (nuevo tab, correlativo propio y reporte Excel en 2 hojas), y ajustes de notificaciones con alertas sonoras y disparadores automáticos.

**Architecture:** Monolito modular (.NET 10 Web API + MongoDB en backend; React 19 + TypeScript + Vite + Tailwind en frontend). Las transferencias bloquean existencias atómicamente; las órdenes de stock poseen su propio correlativo (`OF-XXXX`) y se aíslan de las métricas comerciales; el frontend genera alertas sonoras nativas con Web Audio API en streaming SSE.

**Tech Stack:**
- Backend: C# 13 / .NET 10, MongoDB Driver, ClosedXML, xUnit + FluentAssertions, Moq.
- Frontend: React 19, TypeScript, Tailwind CSS, Lucide Icons, Sonner (Toasts), Radix UI (Dialog, Select, Tabs, Badge).

## Global Constraints
- **YAGNI & Ponytail Full:** Código mínimo, directo y limpio sin sobreingeniería.
- **Sin git commit automático:** El usuario se encarga de los commits manualmente. No ejecutar `git commit`.
- **TDD:** Cada tarea backend se inicia con pruebas unitarias en xUnit antes de implementar.
- **Build Clean:** Al concluir, `dotnet test` y `npm run build` deben compilar con 0 errores.

---

### Task 1: Ciclo Reserva ➡️ Pedido & Deducción de Stock (Backend & Frontend)

**Files:**
- Modify: `src/Application/Inventory/IStockReservationService.cs`
- Modify: `src/Application/Inventory/StockReservationService.cs`
- Modify: `src/Api/Controllers/StockController.cs`
- Modify: `src/Application/Inventory/IPhysicalStockRepository.cs`
- Modify: `src/Infrastructure/Repositories/PhysicalStockRepository.cs`
- Test: `tests/Ordina.Application.Tests/StockReservationServiceTests.cs`
- Modify: `Ordina.Frontend/src/lib/api-client.ts`
- Modify: `Ordina.Frontend/src/components/orders/new-order-dialog.tsx`

**Interfaces:**
- Produces:
  - `IStockReservationService.ConfirmReservationAsync(string reservationId, string orderNumber, CancellationToken ct) -> Task<bool>`
  - `IPhysicalStockRepository.DeductReservedStockAsync(string stockId, int quantity, CancellationToken ct) -> Task<bool>`
  - `POST /api/stock/reservations/{id}/confirm`
  - `POST /api/stock/reservations/{id}/extend`
  - Frontend `apiClient.confirmStockReservation(reservationId, orderNumber)`

- [ ] **Step 1: Write failing tests for ConfirmReservation in StockReservationServiceTests**

```csharp
// tests/Ordina.Application.Tests/StockReservationServiceTests.cs
[Fact]
public async Task ConfirmReservationAsync_ActiveReservation_DeductsPhysicalStockAndConfirms()
{
    var res = new StockReservation
    {
        Id = "res-1",
        StockId = "stk-1",
        Quantity = 1,
        Status = "active",
        ExpiresAt = DateTime.UtcNow.AddMinutes(10)
    };
    _resRepoMock.Setup(r => r.GetByIdAsync("res-1", default)).ReturnsAsync(res);
    _stockRepoMock.Setup(r => r.DeductReservedStockAsync("stk-1", 1, default)).ReturnsAsync(true);

    var success = await _service.ConfirmReservationAsync("res-1", "ORD-1001");

    success.Should().BeTrue();
    res.Status.Should().Be("confirmed");
    res.OrderNumber.Should().Be("ORD-1001");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj`
Expected: FAIL (ConfirmReservationAsync / DeductReservedStockAsync not implemented).

- [ ] **Step 3: Implement DeductReservedStockAsync and ConfirmReservationAsync**

In `IPhysicalStockRepository` & `PhysicalStockRepository`:
```csharp
public async Task<bool> DeductReservedStockAsync(string stockId, int quantity, CancellationToken ct = default)
{
    var filter = Builders<PhysicalStock>.Filter.And(
        Builders<PhysicalStock>.Filter.Eq(s => s.Id, stockId),
        Builders<PhysicalStock>.Filter.Gte(s => s.Quantity, quantity),
        Builders<PhysicalStock>.Filter.Gte(s => s.ReservedQuantity, quantity)
    );
    var update = Builders<PhysicalStock>.Update
        .Inc(s => s.Quantity, -quantity)
        .Inc(s => s.ReservedQuantity, -quantity)
        .Set(s => s.UpdatedAt, DateTime.UtcNow);

    var result = await _collection.UpdateOneAsync(filter, update, cancellationToken: ct);
    return result.ModifiedCount > 0;
}
```

In `StockReservationService`:
```csharp
public async Task<bool> ConfirmReservationAsync(string reservationId, string orderNumber, CancellationToken ct = default)
{
    var res = await resRepo.GetByIdAsync(reservationId, ct);
    if (res == null || res.Status != "active") return false;

    var deducted = await stockRepo.DeductReservedStockAsync(res.StockId, res.Quantity, ct);
    if (!deducted) return false;

    res.Status = "confirmed";
    res.OrderNumber = orderNumber;
    res.UpdatedAt = DateTime.UtcNow;
    await resRepo.UpdateAsync(res, ct);
    return true;
}
```

In `StockController`:
```csharp
[HttpPost("reservations/{id}/confirm")]
public async Task<IActionResult> ConfirmReservation(string id, [FromBody] ConfirmReservationDto dto, CancellationToken ct)
{
    var ok = await reservationService.ConfirmReservationAsync(id, dto.OrderNumber, ct);
    return ok ? Ok(new { success = true }) : BadRequest("No se pudo confirmar la reserva.");
}
```

- [ ] **Step 4: Update new-order-dialog.tsx in Frontend**

In `new-order-dialog.tsx`:
1. Read URL query parameters `stockId`, `productId`, `reservationId`.
2. When present, query stock details and pre-select product/variant and location.
3. Upon order completion:
   - If created as `Reserva`: Call `apiClient.extendStockReservation(reservationId, newOrderNumber)`.
   - If created as normal Order: Call `apiClient.confirmStockReservation(reservationId, newOrderNumber)`.

- [ ] **Step 5: Run tests and frontend build to verify**

Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj`
Run: `npm run build` in `Ordina.Frontend`
Expected: PASS (all tests passing, frontend builds with 0 errors).

---

### Task 2: Transferencias y Traspasos entre Sedes: Backend Entity, Service & Controller

**Files:**
- Create: `src/Domain/Inventory/StockTransfer.cs`
- Create: `src/Application/Inventory/StockTransferDtos.cs`
- Create: `src/Application/Inventory/IStockTransferService.cs`
- Create: `src/Application/Inventory/StockTransferService.cs`
- Create: `src/Api/Controllers/StockTransfersController.cs`
- Modify: `src/Infrastructure/InfrastructureServiceExtensions.cs`
- Modify: `src/Application/ApplicationServiceExtensions.cs`
- Test: `tests/Ordina.Application.Tests/StockTransferServiceTests.cs`

**Interfaces:**
- Produces:
  - `StockTransfer`: Entity with `TransferNumber`, `StockId`, `OriginLocationId`, `DestinationLocationId`, `Quantity`, `Status = "in_transit"`.
  - `IStockTransferService.CreateTransferAsync(CreateStockTransferDto, CancellationToken) -> Task<StockTransferDto>`
  - `IStockTransferService.ConfirmTransferAsync(string transferId, string transferredBy, CancellationToken) -> Task<StockTransferDto>`
  - `IStockTransferService.CancelTransferAsync(string transferId, CancellationToken) -> Task<bool>`
  - `IStockTransferService.GetAllTransfersAsync(string? status, string? locationId, CancellationToken) -> Task<IReadOnlyList<StockTransferDto>>`
  - Controller: `/api/stock-transfers`

- [ ] **Step 1: Write failing tests for StockTransferService**

```csharp
// tests/Ordina.Application.Tests/StockTransferServiceTests.cs
[Fact]
public async Task CreateTransferAsync_AvailableStock_SetsInTransitAndDecrementsAvailable()
{
    var stock = new PhysicalStock { Id = "stk-1", LocationId = "guatire", Quantity = 5, ReservedQuantity = 0 };
    _stockRepoMock.Setup(r => r.GetByIdAsync("stk-1", default)).ReturnsAsync(stock);
    _stockRepoMock.Setup(r => r.ReserveStockAtomicAsync("stk-1", 2, default)).ReturnsAsync(true);

    var dto = new CreateStockTransferDto("stk-1", "terrinca", "Depósito Terrinca", "warehouse", 2, "Aarón", "Reposición");
    var result = await _service.CreateTransferAsync(dto);

    result.Should().NotBeNull();
    result.Status.Should().Be("in_transit");
    result.Quantity.Should().Be(2);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj`
Expected: FAIL (classes not defined).

- [ ] **Step 3: Implement StockTransfer entity, service and controller**

Implement `StockTransfer.cs`, `StockTransferDtos.cs`, `IStockTransferService.cs`, `StockTransferService.cs`, and `StockTransfersController.cs`.
Register `IRepository<StockTransfer>` in MongoDB and `IStockTransferService` in DI.

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj`
Expected: PASS.

---

### Task 3: Transferencias y Traspasos entre Sedes: Frontend UI & Navigation

**Files:**
- Modify: `Ordina.Frontend/src/lib/api-client.ts`
- Modify: `Ordina.Frontend/src/components/inventory/stock-list-page.tsx`
- Create: `Ordina.Frontend/src/components/inventory/stock-transfers-page.tsx`
- Create: `Ordina.Frontend/src/app/inventario/transferencias/page.tsx`
- Modify: `Ordina.Frontend/src/components/layout/sidebar.tsx`
- Modify: `Ordina.Frontend/src/contexts/NavigationContext.tsx`
- Modify: `Ordina.Frontend/src/App.tsx`

**Interfaces:**
- Produces:
  - `apiClient.getStockTransfers(params)`
  - `apiClient.createStockTransfer(dto)`
  - `apiClient.confirmStockTransfer(id)`
  - `apiClient.cancelStockTransfer(id)`
  - Route `/inventario/transferencias`

- [ ] **Step 1: Add StockTransfer methods to api-client.ts**
- [ ] **Step 2: Add "Solicitar Traslado" dialog in stock-list-page.tsx**
- [ ] **Step 3: Build StockTransfersPage component (`/inventario/transferencias`)**
- [ ] **Step 4: Register route in App.tsx, sidebar.tsx and NavigationContext.tsx**
- [ ] **Step 5: Run npm run build in Ordina.Frontend**
Expected: Build passes with 0 errors.

---

### Task 4: Órdenes de Fabricación Interna para Stock: Backend

**Files:**
- Create: `src/Domain/Orders/ManufacturingOrder.cs`
- Create: `src/Application/Orders/ManufacturingOrderDtos.cs`
- Create: `src/Application/Orders/IManufacturingOrderService.cs`
- Create: `src/Application/Orders/ManufacturingOrderService.cs`
- Create: `src/Api/Controllers/ManufacturingOrdersController.cs`
- Modify: `src/Infrastructure/InfrastructureServiceExtensions.cs`
- Modify: `src/Application/ApplicationServiceExtensions.cs`
- Modify: `src/Application/Dashboard/DashboardService.cs` (ensure isolation from sales)
- Test: `tests/Ordina.Application.Tests/ManufacturingOrderServiceTests.cs`

**Interfaces:**
- Produces:
  - `ManufacturingOrder`: `OrderNumber` (OF-0001), `OrderType = "StockReplenishment"`, `RequestedBy`, `DestinationLocationId`, `Status`.
  - `IManufacturingOrderService.CreateAsync`, `GetAllAsync`, `UpdateStatusAsync`.
  - Controller: `/api/manufacturing-orders`.

- [ ] **Step 1: Write failing tests for ManufacturingOrderService**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement ManufacturingOrder entity, service, controller and dashboard isolation**
- [ ] **Step 4: Run tests to verify they pass**
Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj`
Expected: PASS.

---

### Task 5: Órdenes de Fabricación Interna para Stock: Frontend UI & Excel con 2 Hojas

**Files:**
- Modify: `Ordina.Frontend/src/lib/api-client.ts`
- Modify: `Ordina.Frontend/src/app/pedidos/fabricacion/page.tsx`
- Create: `Ordina.Frontend/src/components/manufacturing/stock-orders-tab.tsx`
- Create: `Ordina.Frontend/src/components/manufacturing/new-stock-order-dialog.tsx`
- Modify: `src/Application/Reports/FabricacionReportService.cs` (Excel ClosedXML with 2 sheets)

**Interfaces:**
- Produces:
  - Tabs in `/pedidos/fabricacion`: Tab 1 "Pedidos de Clientes", Tab 2 "Órdenes de Fabricación (Stock)".
  - Excel download with Sheet 1 "Fabricación de Pedidos" and Sheet 2 "Órdenes de Fabricación".

- [ ] **Step 1: Update FabricacionReportService for 2-sheet Excel generation**
- [ ] **Step 2: Add API client methods for manufacturing orders**
- [ ] **Step 3: Create StockOrdersTab and NewStockOrderDialog in Frontend**
- [ ] **Step 4: Update fabricacion page with tabs**
- [ ] **Step 5: Run tests and frontend build to verify**
Expected: PASS.

---

### Task 6: Alertas Sonoras y Disparadores Automáticos de Notificaciones

**Files:**
- Modify: `Ordina.Frontend/src/hooks/use-notifications.ts`
- Modify: `Ordina.Frontend/src/components/layout/sidebar.tsx`
- Modify: `src/Application/Orders/OrderService.cs` (or OrdersController)
- Modify: `src/Application/Inventory/StockReservationService.cs`
- Modify: `src/Api/Controllers/StockController.cs`

**Interfaces:**
- Produces:
  - Web Audio API notification chime on every incoming SSE notification.
  - Automatic triggers on order status: `Retiro por tienda`, `Retiro por almacén`, `Express`.
  - Replenishment alert to Terrinca when store stock is sold.
  - CRM "Repesca" alert for reservations > 30 days.

- [ ] **Step 1: Implement Web Audio API chime in use-notifications.ts**
```typescript
function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Ignore audio autoplay restrictions
  }
}
```
- [ ] **Step 2: Wire automatic triggers for Retiro Tienda, Retiro Almacén, Express in Order updates**
- [ ] **Step 3: Wire replenishment trigger when physical stock drops below threshold in store**
- [ ] **Step 4: Add CRM Repesca notification generator for reservations > 30 days**
- [ ] **Step 5: Verify build**
Run: `npm run build` in `Ordina.Frontend`
Expected: PASS.

---

### Task 7: Verificación Integral End-to-End & Checklist

- [ ] **Step 1: Run all backend tests**
Run: `dotnet run --project tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj`
Expected: Total tests passing, 0 errors.

- [ ] **Step 2: Run frontend production build**
Run: `npm run build` in `Ordina.Frontend`
Expected: Built cleanly with 0 errors.

- [ ] **Step 3: Verify git status (No commits made)**
Run: `git status -s`
Expected: Working tree updated, 0 commits made.
