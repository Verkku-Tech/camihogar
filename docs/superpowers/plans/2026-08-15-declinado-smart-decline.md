# Declinado Inteligente - Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que el flujo de Declinado solo cambie productos en estados Generado/Validado, preserve productos en fabricación/ruta/almacén, y permita agregar una razón opcional editable.

**Architecture:** Cambios en la capa de datos (entity + DTO), lógica de negocio (service + aggregation), reportes (eliminar skip a nivel pedido), API (nuevo request body), y frontend (Card editable + audit log labels).

**Tech Stack:** .NET 9 / MongoDB / xunit / Next.js 14 / TypeScript

---

## File Structure

| Archivo | Cambio |
|---------|--------|
| `Ordina.Backend/src/Infrastructure/Ordina.Database/Entities/Order/Order.cs` | Agregar `DeclineReason` |
| `Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/DTOs/OrderResponseDto.cs` | Agregar `DeclineReason` |
| `Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/Services/IOrderService.cs` | Actualizar firma |
| `Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/Services/OrderService.cs` | Smart decline + reason |
| `Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/Services/IOrderAuditLogService.cs` | Agregar `declineReason` |
| `Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/Services/OrderAuditLogService.cs` | Incluir razón en summary |
| `Ordina.Backend/src/Application/Orders/Ordina.Orders.Api/Controllers/OrdersController.cs` | DTO + actualizar endpoint |
| `Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/ReportService.cs` | Eliminar 3 skips |
| `Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/DispatchReportFilters.cs` | Eliminar 1 skip |
| `Ordina.Frontend/lib/api-client.ts` | Agregar reason a `declineOrder` |
| `Ordina.Frontend/lib/storage.ts` | Agregar `declineReason` a Order |
| `Ordina.Frontend/app/pedidos/[orderNumber]/page.tsx` | Card de razón |
| `Ordina.Frontend/components/orders/audit-log-labels.ts` | Labels nuevas acciones |
| `Ordina.Frontend/components/orders/order-audit-log-dialog.tsx` | ACTION_OPTIONS |
| `Ordina.Backend/tests/Ordina.Orders.Application.Tests/OrderStatusAggregationTests.cs` | Tests nuevos |
| `Ordina.Backend/tests/Ordina.Orders.Application.Tests/DispatchReportFiltersTests.cs` | Test actualizado |

---

## Task 1: Entity + DTO - Agregar campo DeclineReason

**Files:**
- Modify: `Ordina.Backend/src/Infrastructure/Ordina.Database/Entities/Order/Order.cs`
- Modify: `Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/DTOs/OrderResponseDto.cs`

- [ ] **Step 1: Agregar DeclineReason a Order entity**

```csharp
// Ordina.Backend/src/Infrastructure/Ordina.Database/Entities/Order/Order.cs
// Agregar después de la línea con DispatchObservations:

[BsonElement("declineReason")]
public string? DeclineReason { get; set; }
```

- [ ] **Step 2: Agregar DeclineReason a OrderResponseDto**

```csharp
// Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/DTOs/OrderResponseDto.cs
// Agregar después de la línea con DispatchObservations:

public string? DeclineReason { get; set; }
```

- [ ] **Step 3: Verificar que MapToDto incluye el campo**

```bash
# Buscar el método MapToDto en OrderService.cs para verificar que mapea DeclineReason
grep -n "DeclineReason\|DeclinReason" Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/Services/OrderService.cs
```

Si no está en MapToDto, agregar:
```csharp
DeclineReason = order.DeclineReason,
```

- [ ] **Step 4: Commit**

```bash
git add Ordina.Backend/src/Infrastructure/Ordina.Database/Entities/Order/Order.cs Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/DTOs/OrderResponseDto.cs
git commit -m "feat: add DeclineReason field to Order entity and DTO"
```

---

## Task 2: Service Layer - Actualizar firmas e implementación

**Files:**
- Modify: `Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/Services/IOrderService.cs`
- Modify: `Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/Services/OrderService.cs`
- Modify: `Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/Services/IOrderAuditLogService.cs`
- Modify: `Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/Services/OrderAuditLogService.cs`

- [ ] **Step 1: Actualizar firma en IOrderService**

```csharp
// Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/Services/IOrderService.cs
// Cambiar la firma de DeclineOrderAsync:

/// <summary>Declina un pedido: solo productos Generado/Validado pasan a Declinado.</summary>
Task<OrderResponseDto> DeclineOrderAsync(string id, string userId, string userName, string? declineReason);
```

- [ ] **Step 2: Actualizar firma en IOrderAuditLogService**

```csharp
// Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/Services/IOrderAuditLogService.cs
// Cambiar la firma de LogOrderDeclinedAsync:

Task LogOrderDeclinedAsync(Order order, string userId, string userName, string? declineReason);
```

- [ ] **Step 3: Implementar smart decline en OrderService.DeclineOrderAsync**

```csharp
// Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/Services/OrderService.cs
// Reemplazar el método DeclineOrderAsync completo:

public async Task<OrderResponseDto> DeclineOrderAsync(string id, string userId, string userName, string? declineReason)
{
    try
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ArgumentException("El ID del pedido es requerido", nameof(id));
        }

        var existingOrder = await _orderRepository.GetByIdAsync(id);
        if (existingOrder == null)
        {
            throw new KeyNotFoundException($"Pedido con ID {id} no encontrado");
        }

        if (OrderDocumentTypes.IsReservationType(existingOrder.Type)
            || string.Equals(existingOrder.Type, "Budget", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("Solo se pueden declinar pedidos (no presupuestos ni reservas).");
        }

        if (!OrderStatusAggregation.IsDeclinedStatus(existingOrder.Status)
            && existingOrder.Products != null)
        {
            var softStatuses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                { "Generado", "Validado" };

            foreach (var product in existingOrder.Products)
            {
                if (softStatuses.Contains(product.LogisticStatus))
                {
                    product.LogisticStatus = "Declinado";
                }
            }
        }

        existingOrder.DeclineReason = declineReason;
        existingOrder.UpdatedAt = DateTime.UtcNow;
        RecalculateOrderStatus(existingOrder);
        var updatedOrder = await _orderRepository.UpdateAsync(existingOrder);
        await _auditLogService.LogOrderDeclinedAsync(updatedOrder, userId, userName, declineReason);
        return MapToDto(updatedOrder);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error al declinar el pedido con ID {OrderId}", id);
        throw;
    }
}
```

- [ ] **Step 4: Actualizar ReactivateOrderAsync para limpiar DeclineReason**

```csharp
// Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/Services/OrderService.cs
// En ReactivateOrderAsync, agregar después de existingOrder.UpdatedAt = DateTime.UtcNow:

existingOrder.DeclineReason = null;
```

- [ ] **Step 5: Actualizar LogOrderDeclinedAsync en OrderAuditLogService**

```csharp
// Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/Services/OrderAuditLogService.cs
// Reemplazar LogOrderDeclinedAsync completo:

public async Task LogOrderDeclinedAsync(Order order, string userId, string userName, string? declineReason)
{
    try
    {
        var summary = string.IsNullOrWhiteSpace(declineReason)
            ? $"Declinó el pedido {order.OrderNumber} (cliente {order.ClientName})"
            : $"Declinó el pedido {order.OrderNumber} (cliente {order.ClientName}). Razón: {declineReason}";

        var log = new OrderAuditLog
        {
            OrderId = order.Id,
            OrderNumber = order.OrderNumber,
            Action = ActionOrderDeclined,
            UserId = userId,
            UserName = userName,
            Summary = summary,
            Changes = new List<AuditChange>(),
            Timestamp = DateTime.UtcNow
        };
        await _repository.CreateAsync(log);
    }
    catch (Exception ex)
    {
        _logger.LogWarning(ex, "No se pudo registrar auditoría de declinación del pedido {OrderNumber}", order.OrderNumber);
    }
}
```

- [ ] **Step 6: Commit**

```bash
git add Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/Services/
git commit -m "feat: implement smart decline logic with optional reason parameter"
```

---

## Task 3: Controller - DTO y endpoint

**Files:**
- Modify: `Ordina.Backend/src/Application/Orders/Ordina.Orders.Api/Controllers/OrdersController.cs`

- [ ] **Step 1: Crear DeclineOrderRequest DTO**

```csharp
// Ordina.Backend/src/Application/Orders/Ordina.Orders.Api/Controllers/OrdersController.cs
// Agregar antes de la clase OrdersController (o en un archivo separado):

public class DeclineOrderRequest
{
    public string? Reason { get; set; }
}
```

- [ ] **Step 2: Actualizar endpoint DeclineOrder**

```csharp
// Ordina.Backend/src/Application/Orders/Ordina.Orders.Api/Controllers/OrdersController.cs
// Reemplazar el método DeclineOrder:

[HttpPost("{id}/decline")]
[Authorize]
[ProducesResponseType(typeof(OrderResponseDto), StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status400BadRequest)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
public async Task<ActionResult<OrderResponseDto>> DeclineOrder(string id, [FromBody] DeclineOrderRequest? request)
{
    try
    {
        if (!IsAdministratorOrSuperAdministrator(User))
            return Forbid();

        var (userId, userName) = GetActor(User);
        var order = await _orderService.DeclineOrderAsync(id, userId, userName, request?.Reason);
        return Ok(order);
    }
    catch (ArgumentException ex)
    {
        return BadRequest(new { message = ex.Message });
    }
    catch (KeyNotFoundException ex)
    {
        return NotFound(new { message = ex.Message });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error al declinar el pedido con ID {OrderId}", id);
        return StatusCode(500, new { message = "Error interno del servidor" });
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add Ordina.Backend/src/Application/Orders/Ordina.Orders.Api/Controllers/OrdersController.cs
git commit -m "feat: add DeclineOrderRequest DTO and reason parameter to decline endpoint"
```

---

## Task 4: Reportes - Eliminar skip a nivel pedido

**Files:**
- Modify: `Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/ReportService.cs`
- Modify: `Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/DispatchReportFilters.cs`

- [ ] **Step 1: Eliminar skip en ReportService (manufacturing)**

```csharp
// Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/ReportService.cs
// Buscar y eliminar el bloque (aprox línea 344):

// PEDIDO DECLINADO:
if (OrderStatusAggregation.IsDeclinedStatus(order.Status))
{
    continue;
}
```

- [ ] **Step 2: Eliminar skip en ReportService (payments)**

```csharp
// Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/ReportService.cs
// Buscar y eliminar el bloque (aprox línea 954):

if (OrderStatusAggregation.IsDeclinedStatus(order.Status))
    continue;
```

- [ ] **Step 3: Eliminar skip en ReportService (commissions)**

```csharp
// Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/ReportService.cs
// Buscar y eliminar el bloque (aprox línea 1643):

if (OrderStatusAggregation.IsDeclinedStatus(order.Status))
    continue;
```

- [ ] **Step 4: Eliminar skip en DispatchReportFilters**

```csharp
// Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/DispatchReportFilters.cs
// Buscar y eliminar el bloque (aprox línea 58):

if (OrderStatusAggregation.IsDeclinedStatus(order.Status))
    return false;
```

- [ ] **Step 5: Verificar que el filtrado por producto individual existe**

```bash
# Verificar que cada reporte itera productos y filtra por LogisticStatus
grep -n "LogisticStatus\|Declinado" Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/ReportService.cs | head -20
```

Los reportes ya filtran productos individuales por estado. Los productos Declinado no pasarán esos filtros.

- [ ] **Step 6: Commit**

```bash
git add Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/ReportService.cs Ordina.Backend/src/Application/Orders/Ordina.Orders.Application/DispatchReportFilters.cs
git commit -m "feat: remove order-level decline exclusion from reports, rely on product filtering"
```

---

## Task 5: Tests Backend

**Files:**
- Modify: `Ordina.Backend/tests/Ordina.Orders.Application.Tests/OrderStatusAggregationTests.cs`
- Modify: `Ordina.Backend/tests/Ordina.Orders.Application.Tests/DispatchReportFiltersTests.cs`

- [ ] **Step 1: Agregar test - Declined + Manufacturing = Declined**

```csharp
// Ordina.Backend/tests/Ordina.Orders.Application.Tests/OrderStatusAggregationTests.cs
// Agregar al final de la clase:

[Fact]
public void CalculateFromProducts_WithDeclinedAndManufacturing_ReturnsDeclined()
{
    var products = new List<OrderProduct>
    {
        new() { LogisticStatus = "Declinado" },
        new() { LogisticStatus = "Fabricándose" },
    };

    var result = OrderStatusAggregation.CalculateFromProducts(products);

    Assert.Equal("Declinado", result);
}
```

- [ ] **Step 2: Agregar test - Declined + Completed = Completed**

```csharp
// Ordina.Backend/tests/Ordina.Orders.Application.Tests/OrderStatusAggregationTests.cs
// Agregar después del test anterior:

[Fact]
public void CalculateFromProducts_DeclinedAndCompleted_ReturnsCompleted()
{
    var products = new List<OrderProduct>
    {
        new() { LogisticStatus = "Declinado" },
        new() { LogisticStatus = "Completado" },
    };

    var result = OrderStatusAggregation.CalculateFromProducts(products);

    Assert.Equal("Completado", result);
}
```

- [ ] **Step 3: Agregar test - Solo Declined = Declined**

```csharp
// Ordina.Backend/tests/Ordina.Orders.Application.Tests/OrderStatusAggregationTests.cs
// Agregar después del test anterior:

[Fact]
public void CalculateFromProducts_OnlyDeclined_ReturnsDeclined()
{
    var products = new List<OrderProduct>
    {
        new() { LogisticStatus = "Declinado" },
        new() { LogisticStatus = "Declinado" },
    };

    var result = OrderStatusAggregation.CalculateFromProducts(products);

    Assert.Equal("Declinado", result);
}
```

- [ ] **Step 4: Agregar test - DispatchReportFilters incluye pedido Declinado con producto En Ruta**

```csharp
// Ordina.Backend/tests/Ordina.Orders.Application.Tests/DispatchReportFiltersTests.cs
// Agregar después del test ExcludesDeclinedOrders:

[Fact]
public void IsOrderEligibleForDispatchReport_IncludesDeclinedOrderWithEnRutaProduct()
{
    var order = new Order
    {
        Type = "Order",
        Status = "Declinado",
        Products = new List<OrderProduct>
        {
            new() { LocationStatus = "EN DESPACHO", LogisticStatus = "En Ruta" },
        },
    };

    Assert.True(DispatchReportFilters.IsOrderEligibleForDispatchReport(order));
}
```

- [ ] **Step 5: Ejecutar tests**

```bash
cd Ordina.Backend
$env:DOTNET_ROLL_FORWARD="Major"
dotnet test tests/Ordina.Orders.Application.Tests --filter "OrderStatusAggregation|DispatchReportFilters" -v normal
```

- [ ] **Step 6: Commit**

```bash
git add Ordina.Backend/tests/Ordina.Orders.Application.Tests/
git commit -m "test: add smart decline and report exclusion tests"
```

---

## Task 6: Frontend - API Client y Type

**Files:**
- Modify: `Ordina.Frontend/lib/api-client.ts`
- Modify: `Ordina.Frontend/lib/storage.ts`

- [ ] **Step 1: Actualizar declineOrder en api-client.ts**

```typescript
// Ordina.Frontend/lib/api-client.ts
// Reemplazar el método declineOrder:

async declineOrder(orderId: string, reason?: string) {
  return this.request<OrderResponseDto>(`/api/Orders/${orderId}/decline`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
```

- [ ] **Step 2: Agregar declineReason al interface Order en storage.ts**

```typescript
// Ordina.Frontend/lib/storage.ts
// Agregar al interface Order después de dispatchObservations:

declineReason?: string;
```

- [ ] **Step 3: Commit**

```bash
git add Ordina.Frontend/lib/api-client.ts Ordina.Frontend/lib/storage.ts
git commit -m "feat: add reason parameter to declineOrder API client and Order type"
```

---

## Task 7: Frontend - Card de razón del declinado

**Files:**
- Modify: `Ordina.Frontend/app/pedidos/[orderNumber]/page.tsx`

- [ ] **Step 1: Agregar useState para declineReason**

```typescript
// Ordina.Frontend/app/pedidos/[orderNumber]/page.tsx
// Agregar después del useState de confirmAction (aprox línea 577):

const [declineReason, setDeclineReason] = useState(order?.declineReason ?? "");
const [savingDeclineReason, setSavingDeclineReason] = useState(false);
```

- [ ] **Step 2: Agregar handler para guardar razón**

```typescript
// Ordina.Frontend/app/pedidos/[orderNumber]/page.tsx
// Agregar después de handleReactivateOrder:

const handleSaveDeclineReason = async () => {
  if (!order) return;
  setSavingDeclineReason(true);
  try {
    await apiClient.updateOrder(order.id, { declineReason } as any);
    setOrder({ ...order, declineReason });
  } catch (error) {
    console.error("Error guardando razón del declinado:", error);
  } finally {
    setSavingDeclineReason(false);
  }
};
```

- [ ] **Step 3: Agregar Card de razón del declinado**

```tsx
// Ordina.Frontend/app/pedidos/[orderNumber]/page.tsx
// Agregar DESPUÉS de la sección de Observaciones de Despacho (aprox línea 2092),
// ANTES de la sección de Productos (aprox línea 2094):

{order.status === "Declinado" && (
  <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/50">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
        <AlertCircle className="w-5 h-5" />
        Razón del Declinado
      </CardTitle>
    </CardHeader>
    <CardContent>
      <Textarea
        value={declineReason}
        onChange={(e) => setDeclineReason(e.target.value)}
        placeholder="Motivo por el cual se declinó el pedido..."
        rows={3}
        className="w-full"
      />
      <Button
        onClick={handleSaveDeclineReason}
        disabled={savingDeclineReason || declineReason === (order.declineReason ?? "")}
        className="mt-2"
        size="sm"
      >
        {savingDeclineReason ? "Guardando..." : "Guardar"}
      </Button>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 4: Sync declineReason cuando cambia order**

```typescript
// Ordina.Frontend/app/pedidos/[orderNumber]/page.tsx
// En el useEffect que carga el pedido, sincronizar declineReason:
// Agregar después de setOrder(foundOrder):

setDeclineReason(foundOrder.declineReason ?? "");
```

- [ ] **Step 5: Commit**

```bash
git add Ordina.Frontend/app/pedidos/\[orderNumber\]/page.tsx
git commit -m "feat: add decline reason Card section to order detail page"
```

---

## Task 8: Frontend - Audit Log Labels

**Files:**
- Modify: `Ordina.Frontend/components/orders/audit-log-labels.ts`
- Modify: `Ordina.Frontend/components/orders/order-audit-log-dialog.tsx`

- [ ] **Step 1: Agregar labels en audit-log-labels.ts**

```typescript
// Ordina.Frontend/components/orders/audit-log-labels.ts
// Agregar en el objeto de labels:

order_declined: "Pedido Declinado",
order_decline_reverted: "Declinación Revertida",
```

- [ ] **Step 2: Agregar ACTION_OPTIONS en order-audit-log-dialog.tsx**

```typescript
// Ordina.Frontend/components/orders/order-audit-log-dialog.tsx
// Agregar al array ACTION_OPTIONS:

{ value: "order_declined", label: "Pedido Declinado" },
{ value: "order_decline_reverted", label: "Declinación Revertida" },
```

- [ ] **Step 3: Commit**

```bash
git add Ordina.Frontend/components/orders/audit-log-labels.ts Ordina.Frontend/components/orders/order-audit-log-dialog.tsx
git commit -m "feat: add audit log labels and dialog options for decline actions"
```

---

## Task 9: Build y Verificación

- [ ] **Step 1: Build backend**

```bash
cd Ordina.Backend
dotnet build src/Application/Orders/Ordina.Orders.Api -c Release
```

- [ ] **Step 2: Ejecutar tests**

```bash
cd Ordina.Backend
$env:DOTNET_ROLL_FORWARD="Major"
dotnet test tests/Ordina.Orders.Application.Tests -v normal
```

- [ ] **Step 3: Verificar que no hay errores de build en frontend**

```bash
cd Ordina.Frontend
# Solo verificar sintaxis TS (sin node_modules, no se puede hacer next build)
# Verificar que los archivos editados no tienen errores obvios
```

- [ ] **Step 4: Push**

```bash
git push -u origin spalacios/feat-estado-declinado-v2
```
