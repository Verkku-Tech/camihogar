# Plan de Implementación: Optimización de Rendimiento de Red y Eliminación de Peticiones Duplicadas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar las peticiones duplicadas (`OPTIONS` y reintentos por 500) y reducir el tiempo de carga de Home y Dashboard de >7s a <300ms parametrizando la carga de imágenes (`includeImages` false por defecto en listas) y configurando el proxy Same-Origin en el Worker.

**Architecture:** 
1. `camihogar-ab-router` reenvía `/api/*` directamente a `ch-api-v2.verkku.com` para solicitudes V2, eliminando Preflights CORS al ser Same-Origin (`camihogar.verkku.com`).
2. MongoDB proyecciones en `SpecializedRepositories` y `DashboardRepository` excluyen `partialPayments.images`, `mixedPayments.images`, `products.images` y `originalProducts.images` cuando `includeImages=false`.
3. `OrdersController` y `OrderCoreService` reciben `includeImages` / `getImage` (default `false` en paged, default `true` en id/orderNumber).
4. Corrección de entidad `StockTransfer.cs` eliminando propiedades duplicadas.

**Tech Stack:** .NET 10, C#, MongoDB Driver, Cloudflare Worker (TypeScript/Wrangler), Vite/React SPA.

## Global Constraints
- **NO HACER `git commit`**: Todas las modificaciones deben permanecer sin commitear en el working tree del worktree.
- **NO ALTERAR contenedores legados**: Solo modificar `ordina-modular-api` en RPi (puerto 8090).

---

### Task 1: Corregir entidad `StockTransfer.cs`

**Files:**
- Modify: `Ordina.Backend/src/Domain/Inventory/StockTransfer.cs:64-70`
- Test: `Ordina.Backend/tests/Ordina.Application.Tests/StockTransferEntityTests.cs`

**Interfaces:**
- Consumes: `BaseEntity` (que ya define `CreatedAt` y `UpdatedAt`).
- Produces: `StockTransfer` sin conflicto de metadatos BSON en MongoDB.

- [x] **Step 1: Escribir el test que valida que StockTransfer no tiene conflicto de serialización BSON**

Crear `Ordina.Backend/tests/Ordina.Application.Tests/StockTransferEntityTests.cs`:
```csharp
using MongoDB.Bson.Serialization;
using Ordina.Domain.Inventory;
using Xunit;

namespace Ordina.Application.Tests;

public class StockTransferEntityTests
{
    [Fact]
    public void StockTransfer_ShouldRegisterBsonClassMap_WithoutDuplicateElementNames()
    {
        var classMap = BsonClassMap.LookupClassMap(typeof(StockTransfer));
        Assert.NotNull(classMap);
        
        var createdAtMember = classMap.GetMemberMap(nameof(StockTransfer.CreatedAt));
        Assert.NotNull(createdAtMember);
        Assert.Equal("createdAt", createdAtMember.ElementName);
    }
}
```

- [x] **Step 2: Ejecutar el test para comprobar si falla o pasa**

Run: `dotnet run --project tests/Ordina.Application.Tests`
Expected: Si ya estaba registrado o falla por duplicados, fallará con `BsonSerializationException`.

- [x] **Step 3: Modificar `StockTransfer.cs` eliminando las propiedades duplicadas**

En `Ordina.Backend/src/Domain/Inventory/StockTransfer.cs`:
Eliminar líneas 65-69:
```csharp
<<<<
    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
====
>>>>
```

- [x] **Step 4: Ejecutar tests para verificar que compila y pasa**

Run: `dotnet run --project tests/Ordina.Application.Tests`
Expected: PASS

---

### Task 2: Implementar filtrado y proyección de imágenes en órdenes

**Files:**
- Modify: `Ordina.Backend/src/Application/Common/RepositoryInterfaces.cs:11-25`
- Modify: `Ordina.Backend/src/Infrastructure/Repositories/SpecializedRepositories.cs:190-200`
- Modify: `Ordina.Backend/src/Infrastructure/Repositories/DashboardRepository.cs:12-23`
- Modify: `Ordina.Backend/src/Application/Orders/IOrderCoreService.cs:7-11`
- Modify: `Ordina.Backend/src/Application/Orders/OrderCoreService.cs:29-45, 545-620`
- Modify: `Ordina.Backend/src/Api/Controllers/OrdersController.cs:18-45, 93-115`
- Test: `Ordina.Backend/tests/Ordina.Application.Tests/OrderCoreServiceImageFilteringTests.cs`

**Interfaces:**
- Consumes: `OrderQueryFilter(..., bool IncludeImages = false)`
- Produces: `OrderResponseDto` con o sin imágenes según parámetro `includeImages`.

- [x] **Step 1: Escribir tests unitarios para verificar el comportamiento de `includeImages`**

Crear `Ordina.Backend/tests/Ordina.Application.Tests/OrderCoreServiceImageFilteringTests.cs`:
```csharp
using Moq;
using Ordina.Application.Common;
using Ordina.Application.Orders;
using Ordina.Domain.Orders;
using Microsoft.Extensions.Logging;
using Xunit;

namespace Ordina.Application.Tests;

public class OrderCoreServiceImageFilteringTests
{
    private readonly Mock<IOrderRepository> _orderRepoMock = new();
    private readonly Mock<ILogger<OrderCoreService>> _loggerMock = new();

    private Order CreateOrderWithImages()
    {
        return new Order
        {
            Id = "60c72b2f9b1d8b2badbee123",
            OrderNumber = "ORD-00001",
            ClientName = "Test Client",
            Products = new List<OrderProduct>
            {
                new()
                {
                    Name = "Mesa",
                    Price = 100,
                    Quantity = 1,
                    Total = 100,
                    Images = new List<ProductImage>
                    {
                        new() { Id = "img-1", Base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==" }
                    }
                }
            },
            PartialPayments = new List<PartialPayment>
            {
                new()
                {
                    Id = "pay-1",
                    Amount = 50,
                    Method = "Transferencia",
                    Images = new List<ProductImage>
                    {
                        new() { Id = "pay-img-1", Base64 = "data:image/jpeg;base64,abcdef123456" }
                    }
                }
            }
        };
    }

    [Fact]
    public async Task GetPagedAsync_WhenIncludeImagesIsFalse_ShouldOmitImagesInDto()
    {
        var order = CreateOrderWithImages();
        var pagedResult = new PagedResult<Order>(new List<Order> { order }, 1, 1, 50);
        _orderRepoMock.Setup(r => r.GetFilteredPagedAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<OrderQueryFilter>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(pagedResult);

        var service = new OrderCoreService(_orderRepoMock.Object, _loggerMock.Object);
        var filter = new OrderQueryFilter(IncludeImages: false);
        var result = await service.GetPagedAsync(new PagedRequest(1, 50), filter);

        var item = Assert.Single(result.Items);
        Assert.Null(item.Products[0].Images);
        Assert.Null(item.PartialPayments![0].Images);
    }

    [Fact]
    public async Task GetByIdAsync_WhenIncludeImagesIsTrue_ShouldIncludeImagesInDto()
    {
        var order = CreateOrderWithImages();
        _orderRepoMock.Setup(r => r.GetByIdAsync("60c72b2f9b1d8b2badbee123", It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);

        var service = new OrderCoreService(_orderRepoMock.Object, _loggerMock.Object);
        var result = await service.GetByIdAsync("60c72b2f9b1d8b2badbee123", includeImages: true);

        Assert.NotNull(result);
        Assert.NotNull(result.Products[0].Images);
        Assert.Single(result.Products[0].Images!);
        Assert.NotNull(result.PartialPayments![0].Images);
        Assert.Single(result.PartialPayments![0].Images!);
    }
}
```

- [x] **Step 2: Ejecutar test para verificar que falla antes de la implementación**

Run: `dotnet run --project tests/Ordina.Application.Tests`
Expected: Fails compilation / method signature not found.

- [x] **Step 3: Actualizar `RepositoryInterfaces.cs`**

En `Ordina.Backend/src/Application/Common/RepositoryInterfaces.cs`:
Añadir `bool IncludeImages = false` a `OrderQueryFilter`:
```csharp
public record OrderQueryFilter(
    string? Type = null,
    string? Status = null,
    string? SaleType = null,
    string? ExcludeStatuses = null,
    string? ProductFilterPreset = null,
    string? LocationStatus = null,
    string? ManufacturingStatus = null,
    string? Vendor = null,
    string? ClientSearch = null,
    string? ClientId = null,
    DateTime? DateFrom = null,
    DateTime? DateTo = null,
    bool? IncludeBudgets = null,
    string? SearchTerm = null,
    bool IncludeImages = false);
```

- [x] **Step 4: Actualizar `SpecializedRepositories.cs` con proyección MongoDB**

En `Ordina.Backend/src/Infrastructure/Repositories/SpecializedRepositories.cs` en `GetFilteredPagedAsync`:
```csharp
        var combinedFilter = filters.Count > 0 ? fb.And(filters) : fb.Empty;
        var totalCount = await _collection.CountDocumentsAsync(combinedFilter, cancellationToken: cancellationToken);

        var findFluent = _collection.Find(combinedFilter);
        if (!queryFilter.IncludeImages)
        {
            var projection = Builders<Order>.Projection
                .Exclude("partialPayments.images")
                .Exclude("mixedPayments.images")
                .Exclude("products.images")
                .Exclude("originalProducts.images");
            findFluent = findFluent.Project<Order>(projection);
        }

        var items = await findFluent
            .SortByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<Order>(items, (int)totalCount, page, pageSize);
```

- [x] **Step 5: Actualizar `DashboardRepository.cs` con proyección MongoDB**

En `Ordina.Backend/src/Infrastructure/Repositories/DashboardRepository.cs` en `GetAllOrdersForDashboardAsync`:
```csharp
        var projection = Builders<Order>.Projection
            .Exclude("partialPayments.images")
            .Exclude("mixedPayments.images")
            .Exclude("products.images")
            .Exclude("originalProducts.images");

        var orders = await context.Orders.Find(o => o.StatusString != "Cancelado")
            .Project<Order>(projection)
            .ToListAsync(cancellationToken);
```

- [x] **Step 6: Actualizar `IOrderCoreService.cs` y `OrderCoreService.cs`**

En `Ordina.Backend/src/Application/Orders/IOrderCoreService.cs`:
```csharp
    Task<OrderResponseDto?> GetByIdAsync(string id, bool includeImages = true, CancellationToken cancellationToken = default);
    Task<OrderResponseDto?> GetByOrderNumberAsync(string orderNumber, bool includeImages = true, CancellationToken cancellationToken = default);
```

En `Ordina.Backend/src/Application/Orders/OrderCoreService.cs`:
- En `GetByIdAsync`: `return order != null ? MapToDto(order, includeImages) : null;`
- En `GetByOrderNumberAsync`: `return order != null ? MapToDto(order, includeImages) : null;`
- En `GetPagedAsync`:
  `var includeImages = filter?.IncludeImages ?? false;`
  `var dtos = result.Items.Select(o => MapToDto(o, includeImages)).ToList();`
- En `MapToDto(Order o, bool includeImages = true)`:
  - En productos: `includeImages ? p.Images?.Select(MapImageToDto).ToList() : null`
  - En partial payments: `o.PartialPayments?.Select(p => MapPartialPaymentToDto(p, includeImages)).ToList()`
  - En mixed payments: `o.MixedPayments?.Select(p => MapPartialPaymentToDto(p, includeImages)).ToList()`
- Modificar `MapPartialPaymentToDto(PartialPayment p, bool includeImages = true)`:
  `p.Images != null && includeImages ? p.Images.Select(MapImageToDto).ToList() : null`

- [x] **Step 7: Actualizar `OrdersController.cs`**

En `Ordina.Backend/src/Api/Controllers/OrdersController.cs`:
- En `GetPaged`:
  Añadir `[FromQuery] bool includeImages = false, [FromQuery] bool? getImage = null`
  `var finalIncludeImages = getImage ?? includeImages;`
  Pasar `IncludeImages: finalIncludeImages` a `OrderQueryFilter`.
- En `GetById`:
  Añadir `[FromQuery] bool includeImages = true, [FromQuery] bool? getImage = null`
  `var finalIncludeImages = getImage ?? includeImages;`
  `await orderService.GetByIdAsync(id, finalIncludeImages, cancellationToken)`.
- En `GetByOrderNumber`:
  Añadir `[FromQuery] bool includeImages = true, [FromQuery] bool? getImage = null`
  `var finalIncludeImages = getImage ?? includeImages;`
  `await orderService.GetByOrderNumberAsync(orderNumber, finalIncludeImages, cancellationToken)`.

- [x] **Step 8: Ejecutar tests unitarios para verificar que pasan**

Run: `dotnet run --project tests/Ordina.Application.Tests` y `dotnet run --project tests/Ordina.Api.Tests`
Expected: PASS (todos los tests pasan).

---

### Task 3: Configurar Proxy Same-Origin en el Worker `camihogar-ab-router`

**Files:**
- Modify: `camihogar-ab-router/src/index.ts`

**Interfaces:**
- Consumes: Solicitud entrante a `https://camihogar.verkku.com/*`
- Produces: 
  - Si `url.pathname.startsWith('/api/')` y es V2 $\to$ reenvía a `https://ch-api-v2.verkku.com${url.pathname}${url.search}`.
  - Si es asset o SPA $\to$ reenvía a `https://camihogar-v2.pages.dev`.

- [x] **Step 1: Actualizar `camihogar-ab-router/src/index.ts`**

```typescript
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url)
    const cookieHeader = request.headers.get('Cookie') || ''

    // Check query params for opt-in / opt-out
    const betaParam = url.searchParams.get('beta')

    let isV2 = false
    let setCookieHeader: string | null = null

    if (betaParam === '1') {
      isV2 = true
      // 1-year cookie for v2
      setCookieHeader = 'camihogar_version=v2; Path=/; Max-Age=31536000; SameSite=Lax; Secure'
    } else if (betaParam === '0') {
      isV2 = false
      // Clear cookie to revert to legacy v1
      setCookieHeader = 'camihogar_version=; Path=/; Max-Age=0; SameSite=Lax; Secure'
    } else {
      // Check existing cookie
      isV2 = cookieHeader.includes('camihogar_version=v2')
    }

    if (!isV2) {
      // Pass-through to legacy origin (RPi tunnel port 3000)
      const originResponse = await fetch(request)
      if (setCookieHeader) {
        const newHeaders = new Headers(originResponse.headers)
        newHeaders.set('Set-Cookie', setCookieHeader)
        return new Response(originResponse.body, {
          status: originResponse.status,
          statusText: originResponse.statusText,
          headers: newHeaders
        })
      }
      return originResponse
    }

    // User is on V2!
    // 1. API proxy to .NET 10 Modular Monolith (Same-Origin eliminating CORS preflights)
    if (url.pathname.startsWith('/api/')) {
      const apiTarget = new URL(request.url)
      apiTarget.hostname = 'ch-api-v2.verkku.com'
      apiTarget.protocol = 'https:'
      apiTarget.port = ''

      const apiHeaders = new Headers(request.headers)
      apiHeaders.set('Host', 'ch-api-v2.verkku.com')
      apiHeaders.set('X-Forwarded-Host', url.host)

      const apiRequest = new Request(apiTarget.toString(), {
        method: request.method,
        headers: apiHeaders,
        body: request.body,
        redirect: 'manual'
      })

      const apiResponse = await fetch(apiRequest)
      if (setCookieHeader) {
        const resHeaders = new Headers(apiResponse.headers)
        resHeaders.set('Set-Cookie', setCookieHeader)
        return new Response(apiResponse.body, {
          status: apiResponse.status,
          statusText: apiResponse.statusText,
          headers: resHeaders
        })
      }
      return apiResponse
    }

    // 2. SPA assets proxy to Cloudflare Pages
    const targetUrl = new URL(request.url)
    targetUrl.hostname = 'camihogar-v2.pages.dev'
    targetUrl.protocol = 'https:'
    targetUrl.port = ''

    const reqHeaders = new Headers(request.headers)
    reqHeaders.set('Host', 'camihogar-v2.pages.dev')
    reqHeaders.set('X-Forwarded-Host', url.host)

    const pagesRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers: reqHeaders,
      body: request.body,
      redirect: 'manual'
    })

    const pagesResponse = await fetch(pagesRequest)
    const resHeaders = new Headers(pagesResponse.headers)

    if (setCookieHeader) {
      resHeaders.set('Set-Cookie', setCookieHeader)
    }

    return new Response(pagesResponse.body, {
      status: pagesResponse.status,
      statusText: pagesResponse.statusText,
      headers: resHeaders
    })
  }
}
```

- [x] **Step 2: Desplegar Worker a Cloudflare**

Run: `npx wrangler deploy` en `camihogar-ab-router`
Expected: `Uploaded camihogar-ab-router` `Deployed to camihogar.verkku.com/*`

---

### Task 4: Ajustar Frontend para Same-Origin y SSE

**Files:**
- Modify: `Ordina.Frontend/.env.production`
- Modify: `Ordina.Frontend/src/lib/api-client.ts:107-113, 1200-1230`
- Modify: `Ordina.Frontend/src/hooks/use-notifications.ts:95-102`

- [x] **Step 1: Ajustar `.env.production` y `api-client.ts`**

En `Ordina.Frontend/.env.production`:
```env
VITE_API_URL=
```

En `Ordina.Frontend/src/lib/api-client.ts`:
Asegurar que `API_BASE_URL` detecte si estamos directamente en `pages.dev` o en dominio principal:
```typescript
export const API_BASE_URL = (() => {
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('pages.dev')) {
    return 'https://ch-api-v2.verkku.com'
  }
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
})()
```

- [x] **Step 2: Ajustar `use-notifications.ts` para usar `resolveApiUrl`**

En `Ordina.Frontend/src/hooks/use-notifications.ts`:
```typescript
<<<<
    const streamUrl = `/api/notifications/stream?token=${encodeURIComponent(token)}`
====
    const streamUrl = resolveApiUrl(`/api/notifications/stream?token=${encodeURIComponent(token)}`)
>>>>
```

- [x] **Step 3: Compilar y validar el frontend**

Run: `npm run build` en `Ordina.Frontend`
Expected: Build exitoso sin errores TypeScript.

---

### Task 5: Despliegue en RPi, Cloudflare Pages y Verificación End-to-End

**Files:**
- RPi Container: `ordina-modular-api`
- Cloudflare Pages: `camihogar-v2`

- [x] **Step 1: Compilar backend para Linux ARM64 y desplegar en RPi**

Run: `dotnet publish src/Api/Ordina.Api.csproj -c Release -r linux-arm64 --self-contained false -o bin/arm64-publish`
Empaquetar, transferir por SSH a RPi, actualizar archivos del contenedor y reiniciar `ordina-modular-api`.

- [x] **Step 2: Desplegar Frontend en Cloudflare Pages**

Run: `npx wrangler pages deploy dist --project-name=camihogar-v2` en `Ordina.Frontend`
Expected: `Deployment complete! https://camihogar-v2.pages.dev`

- [x] **Step 3: Verificación con curl de endpoints optimizados**

1. Verificar que `/api/stock-transfers` devuelve 200:
   `curl -i https://camihogar.verkku.com/api/stock-transfers -H "Authorization: Bearer <token>"`
2. Verificar que `/api/orders?page=1&pageSize=50` devuelve <200 KB sin `images`:
   `curl -s "https://camihogar.verkku.com/api/orders?page=1&pageSize=50" -H "Authorization: Bearer <token>" | Measure-Object -Property Length -Sum`
3. Verificar que `/api/orders/{id}?includeImages=true` incluye las imágenes.

- [x] **Step 4: Verificación visual y de red en el navegador**

Navegar a `https://camihogar.verkku.com/?beta=1`:
- Verificar que la pestaña Network no muestra peticiones `OPTIONS` redundantes.
- Verificar que la carga inicial de Home es menor a 500ms.
- Verificar que el indicador de conexión/notificaciones SSE está conectado.
