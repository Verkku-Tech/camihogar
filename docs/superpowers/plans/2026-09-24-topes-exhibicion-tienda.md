# Topes de Exhibición por Producto en Tiendas - Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar la configuración de topes de exhibición físicos por producto en cada tienda, manteniendo la capacidad total del showroom e integrándolo con el cálculo de reposición inteligente desde el Depósito Central Terrinca.

**Architecture:** Almacenamiento embebido de diccionario `productDisplayLimits` (`productId` $\rightarrow$ `limit`) en la entidad `Store` de MongoDB. Endpoint dedicado `PUT /api/stores/{id}/display-limits`. Interfaz en el frontend con acceso dual (botón en la fila de la tienda y pestaña en el diálogo de edición) con buscador de productos, filtro por categoría y cálculo visual de ocupación del showroom.

**Tech Stack:** C# .NET 10, MongoDB Driver, xUnit v3, React 19, TypeScript, Tailwind CSS, Lucide Icons, Sonner.

## Global Constraints

- **REGLA ABSOLUTA:** **NO ejecutar `git commit`** bajo ninguna circunstancia. El usuario realizará los commits personalmente.
- Estilo **Ponytail**: código mínimo, directo, sin abstracciones innecesarias, aprovechando librerías existentes.
- Los límites deben ser enteros no negativos ($\ge 0$).
- La capacidad total del showroom (`MaxCapacity`) se mantiene como referencia del espacio físico global.

---

### Task 1: Backend Domain y DTOs para Topes de Exhibición

**Files:**
- Modify: `Ordina.Backend/src/Domain/Stores/Store.cs`
- Modify: `Ordina.Backend/src/Application/Stores/DTOs.cs`

**Interfaces:**
- Produces: `Store.ProductDisplayLimits: Dictionary<string, int>`, `UpdateStoreDisplayLimitsDto(Dictionary<string, int> ProductDisplayLimits)`

- [ ] **Step 1: Agregar `ProductDisplayLimits` a la entidad `Store`**

En `Ordina.Backend/src/Domain/Stores/Store.cs`:
```csharp
[BsonElement("productDisplayLimits")]
public Dictionary<string, int> ProductDisplayLimits { get; set; } = new();
```

- [ ] **Step 2: Actualizar DTOs en `Ordina.Backend/src/Application/Stores/DTOs.cs`**

Agregar `ProductDisplayLimits` a `StoreDto`, `CreateStoreDto`, `UpdateStoreDto` y definir `UpdateStoreDisplayLimitsDto`:
```csharp
public record StoreDto(
    string Id,
    string Name,
    string Code,
    string Address,
    string Phone,
    string Email,
    string Rif,
    string Status,
    int MaxCapacity,
    Dictionary<string, int> ProductDisplayLimits,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record CreateStoreDto(
    string Name,
    string Code,
    string Address,
    string Phone,
    string Email,
    string Rif,
    int? MaxCapacity = 25,
    Dictionary<string, int>? ProductDisplayLimits = null
);

public record UpdateStoreDto(
    string? Name = null,
    string? Code = null,
    string? Address = null,
    string? Phone = null,
    string? Email = null,
    string? Rif = null,
    string? Status = null,
    int? MaxCapacity = null,
    Dictionary<string, int>? ProductDisplayLimits = null
);

public record UpdateStoreDisplayLimitsDto(
    Dictionary<string, int> ProductDisplayLimits
);
```

- [ ] **Step 3: Compilar Backend para verificar contratos**

Ejecutar:
```powershell
dotnet build Ordina.Backend/Ordina.sln
```
Esperado: 0 errores.

---

### Task 2: Backend Application Service y Controller

**Files:**
- Modify: `Ordina.Backend/src/Application/Stores/StoresServices.cs`
- Modify: `Ordina.Backend/src/Api/Controllers/StoresController.cs`
- Create / Test: `Ordina.Backend/tests/Ordina.Application.Tests/StoreDisplayLimitsTests.cs`

**Interfaces:**
- Produces: `IStoresService.UpdateDisplayLimitsAsync(string id, Dictionary<string, int> limits, CancellationToken ct)`, `PUT /api/stores/{id}/display-limits`

- [ ] **Step 1: Escribir la prueba unitaria fallida**

Crear `Ordina.Backend/tests/Ordina.Application.Tests/StoreDisplayLimitsTests.cs`:
```csharp
using Moq;
using Ordina.Application.Common;
using Ordina.Application.Stores;
using Ordina.Domain.Stores;
using Xunit;

namespace Ordina.Application.Tests;

public class StoreDisplayLimitsTests
{
    [Fact]
    public async Task UpdateDisplayLimitsAsync_UpdatesAndSanitizesLimits()
    {
        var storeId = "store-123";
        var store = new Store
        {
            Id = storeId,
            Name = "Tienda Caracas",
            Code = "CCS",
            MaxCapacity = 25,
            ProductDisplayLimits = new()
        };

        var repoMock = new Mock<IRepository<Store>>();
        repoMock.Setup(r => r.GetByIdAsync(storeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(store);

        var service = new StoresService(repoMock.Object);

        var inputLimits = new Dictionary<string, int>
        {
            { "prod-1", 3 },
            { "prod-2", -5 }, // Negativo debe normalizarse a 0
            { "  prod-3  ", 2 } // Debe limpiar espacios
        };

        var result = await service.UpdateDisplayLimitsAsync(storeId, inputLimits);

        Assert.NotNull(result);
        Assert.Equal(3, result.ProductDisplayLimits["prod-1"]);
        Assert.Equal(0, result.ProductDisplayLimits["prod-2"]);
        Assert.Equal(2, result.ProductDisplayLimits["prod-3"]);
        repoMock.Verify(r => r.UpdateAsync(It.IsAny<Store>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
```

- [ ] **Step 2: Ejecutar test para confirmar que no compila / falla**

Ejecutar:
```powershell
dotnet run --project Ordina.Backend/tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj --filter StoreDisplayLimitsTests
```
Esperado: Falla porque `UpdateDisplayLimitsAsync` no existe en `IStoresService`.

- [ ] **Step 3: Implementar `UpdateDisplayLimitsAsync` y mapeo en `StoresServices.cs`**

En `IStoresService`:
```csharp
Task<StoreDto?> UpdateDisplayLimitsAsync(string id, Dictionary<string, int> limits, CancellationToken ct = default);
```

En `StoresService`:
- En `MapToDto`: pasar `store.ProductDisplayLimits ?? new()`.
- En `CreateAsync`: si `dto.ProductDisplayLimits != null`, asignar sanitized.
- En `UpdateAsync`: si `dto.ProductDisplayLimits != null`, asignar sanitized.
- Implementar `UpdateDisplayLimitsAsync`:
```csharp
public async Task<StoreDto?> UpdateDisplayLimitsAsync(string id, Dictionary<string, int> limits, CancellationToken cancellationToken = default)
{
    var store = await storeRepository.GetByIdAsync(id, cancellationToken);
    if (store == null) return null;

    var sanitized = new Dictionary<string, int>();
    if (limits != null)
    {
        foreach (var (k, v) in limits)
        {
            if (string.IsNullOrWhiteSpace(k)) continue;
            sanitized[k.Trim()] = Math.Max(0, v);
        }
    }

    store.ProductDisplayLimits = sanitized;
    store.UpdatedAt = DateTime.UtcNow;

    await storeRepository.UpdateAsync(store, cancellationToken);
    return MapToDto(store);
}
```

- [ ] **Step 4: Añadir endpoint en `StoresController.cs`**

```csharp
[HttpPut("{id}/display-limits")]
public async Task<ActionResult<StoreDto>> UpdateDisplayLimits(
    string id,
    [FromBody] UpdateStoreDisplayLimitsDto dto,
    CancellationToken ct)
{
    var result = await storesService.UpdateDisplayLimitsAsync(id, dto.ProductDisplayLimits, ct);
    if (result == null) return NotFound();
    return Ok(result);
}
```

- [ ] **Step 5: Ejecutar test unitario para verificar que pasa**

Ejecutar:
```powershell
dotnet run --project Ordina.Backend/tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj --filter StoreDisplayLimitsTests
```
Esperado: 1 passed.

---

### Task 3: Algoritmo de Reposición Inteligente en BI Dashboard

**Files:**
- Modify: `Ordina.Backend/src/Application/Dashboard/DashboardService.cs`

**Interfaces:**
- Consumes: `Store.ProductDisplayLimits`, `PhysicalStock` por tienda y en Terrinca.
- Produces: `DashboardMetrics.ReplenishmentSuggestions` detalladas por producto deficitario.

- [ ] **Step 1: Adaptar cálculo de reposición en `DashboardService.cs`**

En `DashboardService.cs`, enriquecer la generación de sugerencias de reposición:
- Consultar el stock físico por producto en cada tienda.
- Para cada producto con `limit > 0` en `store.ProductDisplayLimits`:
  - `deficit = Math.Max(0, limit - currentPhysicalInStore)`.
  - Si `deficit > 0`: comparar con disponibilidad en Almacén Central (Terrinca) y generar la recomendación de transferencia precisa.

- [ ] **Step 2: Compilar y ejecutar pruebas de aplicación**

Ejecutar:
```powershell
dotnet run --project Ordina.Backend/tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj
```
Esperado: 116 tests pasando.

---

### Task 4: Clientes API y Tipos en Frontend

**Files:**
- Modify: `Ordina.Frontend/src/types/index.ts`
- Modify: `Ordina.Frontend/src/lib/api-client-dtos.ts`
- Modify: `Ordina.Frontend/src/lib/api-client.ts`
- Modify: `Ordina.Frontend/src/lib/storage.ts`

**Interfaces:**
- Produces: `Store.productDisplayLimits?: Record<string, number>`, `apiClient.updateStoreDisplayLimits(storeId, limits)`, `updateStoreDisplayLimits(storeId, limits)`

- [ ] **Step 1: Actualizar tipos e interfaces en `types/index.ts` y `api-client-dtos.ts`**

En `Ordina.Frontend/src/types/index.ts`:
```typescript
export interface Store {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  rif: string;
  maxCapacity?: number;
  productDisplayLimits?: Record<string, number>;
  status: "active" | "inactive";
}
```

En `Ordina.Frontend/src/lib/api-client-dtos.ts`:
```typescript
export interface StoreResponseDto {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  rif: string;
  status: string;
  maxCapacity: number;
  productDisplayLimits?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Agregar método en `api-client.ts` y función en `storage.ts`**

En `Ordina.Frontend/src/lib/api-client.ts`:
```typescript
async updateStoreDisplayLimits(storeId: string, limits: Record<string, number>): Promise<StoreResponseDto> {
  return this.request<StoreResponseDto>(`/stores/${storeId}/display-limits`, {
    method: 'PUT',
    body: JSON.stringify({ productDisplayLimits: limits }),
  });
}
```

En `Ordina.Frontend/src/lib/storage.ts`:
```typescript
export const updateStoreDisplayLimits = async (
  storeId: string,
  limits: Record<string, number>
): Promise<Store> => {
  const res = await apiClient.updateStoreDisplayLimits(storeId, limits);
  return storeFromBackendDto(res);
};
```
Actualizar también `storeFromBackendDto` para mapear `productDisplayLimits: dto.productDisplayLimits || {}`.

---

### Task 5: Componente `StoreProductLimitsDialog`

**Files:**
- Create: `Ordina.Frontend/src/components/stores/store-product-limits-dialog.tsx`

**Interfaces:**
- Consumes: `Store`, `getProducts()`, `getPhysicalStocks()`, `getWarehouses()`, `updateStoreDisplayLimits()`.
- Produces: Diálogo interactivo con contador de capacidad vs showroom, buscador, filtro por categoría y guardado atómico.

- [ ] **Step 1: Crear `store-product-limits-dialog.tsx`**

El componente debe incluir:
- Indicador de capacidad:
  - `Total asignado en exhibición: X piezas` vs `Capacidad Física del Showroom: Y piezas`.
  - Alerta sutil si `X > Y` (advirtiendo sobrecupo físico).
- Buscador de productos en vivo + Selector de Categoría + Checkbox "Solo configurados (> 0)".
- Tabla de productos:
  - Nombre del mueble y categoría.
  - Stock actual en esta tienda.
  - Stock disponible en Almacén Terrinca.
  - Input numérico de Tope de Exhibición con controles `+` / `-` y edición directa.
- Botones de acción: "Restablecer" y "Guardar Topes".
- Feedback con `toast.success("Topes de exhibición actualizados")`.

---

### Task 6: Integración Dual en `stores-page.tsx`

**Files:**
- Modify: `Ordina.Frontend/src/components/stores/stores-page.tsx`

**Interfaces:**
- Consumes: `StoreProductLimitsDialog`
- Produces: Botón directo en la tabla de tiendas + Pestañas dentro del modal "Editar Tienda".

- [ ] **Step 1: Agregar botón de acción directa en la tabla de tiendas**

En cada fila de la tabla de tiendas de `stores-page.tsx`:
- Botón con icono `SlidersHorizontal` o `LayoutGrid` y tooltip *"Topes de Exhibición"*.
- Al hacer clic, abre `StoreProductLimitsDialog` para esa tienda.

- [ ] **Step 2: Agregar pestañas en el modal "Editar Tienda"**

En el modal de edición de tienda:
- Usar `<Tabs defaultValue="info">`:
  - Tab 1: *"Información de Tienda"* (Nombre, Código, Dirección, Teléfono, Correo, RIF, Capacidad Showroom, Estado).
  - Tab 2: *"Topes de Exhibición"* (renderiza la tabla interactiva de productos de la tienda con guardado sincronizado).

---

### Task 7: Verificación Global y Build

**Files:**
- Build / Test: Backend y Frontend

- [ ] **Step 1: Ejecutar suite de pruebas de Backend**

```powershell
dotnet run --project Ordina.Backend/tests/Ordina.Application.Tests/Ordina.Application.Tests.csproj
```
Esperado: 100% pruebas pasando.

- [ ] **Step 2: Ejecutar compilación de Frontend**

```powershell
npm run build --prefix Ordina.Frontend
```
Esperado: 0 errores de TypeScript, bundle generado exitosamente.

- [ ] **Step 3: Verificación de Git (SIN COMMITS)**

```powershell
git status -s
```
Verificar que todos los archivos modificados y nuevos están presentes en el working tree sin commitear.
