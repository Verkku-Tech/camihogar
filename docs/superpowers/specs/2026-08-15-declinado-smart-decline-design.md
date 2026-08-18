# Declinado Inteligente - Diseño

## Resumen

Mejorar el flujo de "Declinado" para que:
1. Solo productos en estados "blandos" (Generado, Validado) se declinen
2. Productos en fabricación, ruta, almacén o tienda conservan su estado
3. El pedido se marca como "Declinado" pero los reportes muestran productos protegidos
4. Se puede agregar una razón opcional del declinado, editable después

## Contexto

El flujo actual de `DeclineOrderAsync` pone **todos** los productos en "Declinado" sin importar su estado. Esto hace que productos en fabricación o ya entregados "desaparezcan" de los reportes, perdiendo visibilidad.

## Decisiones Clave

| Decisión | Elección |
|----------|----------|
| ¿Qué productos pueden declinarse? | Solo Generado y Validado |
| ¿Productos protegidos? | Fabricándose, Reporte de fabricación, En Ruta, En Almacén, Completado |
| ¿Estado del pedido al declinar? | "Declinado" (prioridad actual se mantiene) |
| ¿Cómo se excluyen de reportes? | Eliminar skip a nivel pedido, usar filtrado por producto |
| ¿Dónde va la razón? | Card editable en el detalle del pedido (post-decline) |
| ¿Requerida la razón? | Opcional |
| ¿Editable después? | Sí |
| ¿Visible en auditoría? | Sí, en el Summary del AuditLog |
| ¿Almacenamiento? | Campo `declineReason` en la entidad Order |

## Cambios Backend

### 1. Order Entity

Agregar campo:
```csharp
[BsonElement("declineReason")]
public string? DeclineReason { get; set; }
```

### 2. DeclineOrderAsync

Cambios en `OrderService.DeclineOrderAsync`:
- Aceptar parámetro `string? declineReason`
- Solo cambiar productos con estado "Generado" o "Validado" a "Declinado"
- Guardar `existingOrder.DeclineReason = declineReason`
- pasar `declineReason` a `LogOrderDeclinedAsync`

### 3. ReactivateOrderAsync

Cambios en `OrderService.ReactivateOrderAsync`:
- Limpiar `existingOrder.DeclineReason = null`
- Revertir productos "Declinado" a "Generado" (comportamiento actual)

### 4. OrderStatusAggregation

**Sin cambios en la prioridad.** Se mantiene:
```
Completado > Declinado > Generado > Fabricándose > Reporte de fabricación > Validado > En Almacén > En Ruta
```

Un pedido con productos Declinado + Fabricándose será "Declinado".

### 5. Reportes

Eliminar el skip a nivel de pedido en 4 ubicaciones:

**ReportService.cs** (3 ubicaciones):
- Línea ~344 (manufacturing report)
- Línea ~954 (payment report)
- Línea ~1643 (commission report)

**DispatchReportFilters.cs** (1 ubicación):
- Línea ~58 (`IsOrderEligibleForDispatchReport`)

```csharp
// ANTES (eliminar):
if (OrderStatusAggregation.IsDeclinedStatus(order.Status))
    continue;

// DESPUÉS: el filtrado por producto ya existe en cada reporte
// Los productos Declinado no pasan los filtros de estado individual
```

### 6. Endpoint

```csharp
// OrdersController.cs
[HttpPost("{id}/decline")]
public async Task<IActionResult> DeclineOrder(string id, [FromBody] DeclineOrderRequest request)

// Nuevo DTO
public class DeclineOrderRequest
{
    public string? Reason { get; set; }
}
```

### 7. OrderAuditLogService

```csharp
public async Task LogOrderDeclinedAsync(
    Order order, string userId, string userName, string? declineReason)
{
    var summary = string.IsNullOrWhiteSpace(declineReason)
        ? $"Declinó el pedido {order.OrderNumber} (cliente {order.ClientName})"
        : $"Declinó el pedido {order.OrderNumber} (cliente {order.ClientName}). Razón: {declineReason}";
    
    var log = new OrderAuditLog
    {
        // ... campos existentes ...
        Summary = summary,
    };
    await _repository.CreateAsync(log);
}
```

## Cambios Frontend

### 1. API Client

```typescript
// api-client.ts
async declineOrder(orderId: string, reason?: string) {
  return this.request<OrderResponseDto>(`/api/Orders/${orderId}/decline`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
```

### 2. Order Type

```typescript
// storage.ts - interface Order
declineReason?: string;
```

### 3. Order Detail Page

Nueva Card amber después de Observaciones de Despacho:

```tsx
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
      />
      <Button
        onClick={handleSaveDeclineReason}
        disabled={declineReason === (order.declineReason ?? "")}
        className="mt-2"
      >
        Guardar
      </Button>
    </CardContent>
  </Card>
)}
```

- Posición: después de Observaciones de Despacho (línea ~2092), antes de Productos (línea ~2094)
- Solo visible cuando `order.status === "Declinado"`
- Estado local: `declineReason` (inicializado con `order.declineReason ?? ""`)
- Guarda vía `updateOrder(id, { declineReason: text })`

### 4. Audit Log Labels

```typescript
// audit-log-labels.ts
order_declined: "Pedido Declinado",
order_decline_reverted: "Declinación Revertida",
```

### 5. OrderAuditLogDialog

Agregar acciones al ACTION_OPTIONS:
```typescript
{ value: "order_declined", label: "Pedido Declinado" },
{ value: "order_decline_reverted", label: "Declinación Revertida" },
```

## Tests

### Backend

**OrderStatusAggregationTests (nuevos):**
- `CalculateFromProducts_WithDeclinedAndManufacturing_ReturnsDeclined`
- `CalculateFromProducts_OnlyDeclined_ReturnsDeclined`
- `CalculateFromProducts_DeclinedAndCompleted_ReturnsCompleted`

**OrderServiceTests (nuevos):**
- `DeclineOrderAsync_WithManufacturingProducts_OnlySoftStatusesDeclined`
- `DeclineOrderAsync_WithReason_SavesReason`
- `DeclineOrderAsync_WithoutReason_ReasonIsNull`
- `ReactivateOrderAsync_ClearsDeclineReason`

**ReportServiceTests (nuevos):**
- `ManufacturingReport_IncludesDeclinedOrderWithManufacturingProducts`

### Frontend

- Verificar que la Card de razón aparece solo en estado Declinado
- Verificar que el textarea es editable y el botón Guardar funciona
- Verificar que `declineOrder` envía el reason al backend

## Edge Cases

1. **Pedido sin productos Generado/Validado al declinar:** Todos protegidos → ningún producto se cambia → pedido "Declinado" pero todos los productos conservan estado
2. **Reactivar con productos en fabricación:** Los Fabricandose siguen, los Declinado vuelven a Generado
3. **Agregar razón después de declinar:** Endpoint PUT actualiza `declineReason`
4. **Pedido Declinado sin razón:** Muestra "Sin razón especificada"
5. **Pedido con 1 Generado + 3 Fabricándose → Declinar:** Solo el Generado se declina, estado pedido = Declinado, 3 productos siguen en fabricación
