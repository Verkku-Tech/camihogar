# Inventario Inmediato, Multisede y Reservas Temporales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo integral de Inventario Inmediato y Multisede en CamiHogar, incluyendo el control de capacidad de tiendas, CRUD de almacenes centrales (Terrinca), modelo desacoplado de existencias físicas por variante (`PhysicalStock`), importador masivo en Excel, registro manual de taller, pantalla interactiva de consulta para vendedores y el mecanismo atómico de reservas temporales anti-duplicidad con temporizador de 10 min.

**Architecture:** Arquitectura de monolito modular (.NET 10 Web API + MongoDB en backend; React 19 + TypeScript + Vite + Tailwind en frontend). La entidad `PhysicalStock` desacopla el stock de los productos base indexando por combinación de atributos de variante y sede física; las reservas operan con bloqueos atómicos en MongoDB (`$inc`) y limpieza automática en segundo plano mediante un `BackgroundService`.

**Tech Stack:**
- Backend: C# 13 / .NET 10, MongoDB Driver, ClosedXML (para Excel), xUnit + FluentAssertions.
- Frontend: React 19, TypeScript, Tailwind CSS, Lucide Icons, Sonner (Toasts), Radix UI (Dialog, Select, Badge).

## Global Constraints
- **YAGNI & Ponytail Full:** Escribir el código más simple, directo y conciso que resuelva el requerimiento sin abstracciones innecesarias.
- **Sin mapas pesados:** Ninguna funcionalidad de inventario ni sedes requerirá librerías de mapas que ralenticen la app.
- **Regla de negocio Almacenes:** Solo se gestionan almacenes propios (Tienda Guatire, Tienda Caracas, Almacén Central Terrinca); el depósito de socios externos de Caracas queda excluido.
- **TDD:** Cada tarea backend debe incluir pruebas unitarias con xUnit y ejecutarse con éxito antes de dar por concluida la tarea.
- **Build Clean:** Al finalizar, `dotnet build`, `dotnet test` y `npm run build` deben compilar con 0 errores y warnings críticos.

---

### Task 1: Store MaxCapacity Extension & Warehouse Entity & CRUD (Backend)

**Files:**
- Modify: `src/Domain/Stores/Store.cs:6-28`
- Create: `src/Domain/Stores/Warehouse.cs`
- Modify: `src/Application/Stores/StoreDtos.cs`
- Create: `src/Application/Stores/WarehouseDtos.cs`
- Create: `src/Application/Stores/IWarehouseService.cs`
- Create: `src/Application/Stores/WarehouseService.cs`
- Create: `src/Api/Controllers/WarehousesController.cs`
- Modify: `src/Infrastructure/DependencyInjection.cs`
- Test: `tests/Ordina.Application.Tests/WarehouseServiceTests.cs`

**Interfaces:**
- Produces:
  - `Warehouse`: `Id`, `Name`, `Code`, `Address`, `Phone`, `MaxCapacity`, `IsCentral`, `Status`
  - `IWarehouseService.GetAllAsync() -> Task<IReadOnlyList<WarehouseDto>>`
  - `IWarehouseService.CreateAsync(CreateWarehouseDto) -> Task<WarehouseDto>`
  - `IWarehouseService.UpdateAsync(string id, UpdateWarehouseDto) -> Task<WarehouseDto>`
  - `IWarehouseService.DeleteAsync(string id) -> Task<bool>`
  - `StoresController`: `maxCapacity` en DTOs de `Store`.

- [ ] **Step 1: Write failing test for WarehouseService**

```csharp
// tests/Ordina.Application.Tests/WarehouseServiceTests.cs
using FluentAssertions;
using Moq;
using Ordina.Application.Stores;
using Ordina.Domain.Stores;
using Ordina.Infrastructure.Repositories;
using Xunit;

namespace Ordina.Application.Tests;

public class WarehouseServiceTests
{
    private readonly Mock<IMongoRepository<Warehouse>> _repoMock = new();
    private readonly WarehouseService _service;

    public WarehouseServiceTests()
    {
        _service = new WarehouseService(_repoMock.Object);
    }

    [Fact]
    public async Task CreateAsync_ValidDto_CreatesAndReturnsWarehouse()
    {
        var dto = new CreateWarehouseDto("Depósito Terrinca", "TERR-01", "Zona Industrial Terrinca", "0414-1234567", 150, true);
        _repoMock.Setup(r => r.InsertAsync(It.IsAny<Warehouse>(), default)).Returns(Task.CompletedTask);

        var result = await _service.CreateAsync(dto);

        result.Should().NotBeNull();
        result.Name.Should().Be("Depósito Terrinca");
        result.Code.Should().Be("TERR-01");
        result.IsCentral.Should().BeTrue();
        result.MaxCapacity.Should().Be(150);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test --filter "FullyQualifiedName~WarehouseServiceTests"`
Expected: FAIL with compilation errors (WarehouseService, Warehouse, DTOs not defined).

- [ ] **Step 3: Implement Store.MaxCapacity and Warehouse entity & service**

```csharp
// src/Domain/Stores/Store.cs (add MaxCapacity)
[BsonElement("maxCapacity")]
public int MaxCapacity { get; set; } = 25;

// src/Domain/Stores/Warehouse.cs
using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Stores;

public class Warehouse : BaseEntity
{
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("code")]
    public string Code { get; set; } = string.Empty;

    [BsonElement("address")]
    public string Address { get; set; } = string.Empty;

    [BsonElement("phone")]
    public string Phone { get; set; } = string.Empty;

    [BsonElement("maxCapacity")]
    public int MaxCapacity { get; set; } = 100;

    [BsonElement("isCentral")]
    public bool IsCentral { get; set; } = false;

    [BsonElement("status")]
    public string Status { get; set; } = "active";
}

// src/Application/Stores/WarehouseDtos.cs
namespace Ordina.Application.Stores;

public record WarehouseDto(string Id, string Name, string Code, string Address, string Phone, int MaxCapacity, bool IsCentral, string Status);
public record CreateWarehouseDto(string Name, string Code, string Address, string Phone, int MaxCapacity, bool IsCentral);
public record UpdateWarehouseDto(string Name, string Code, string Address, string Phone, int MaxCapacity, bool IsCentral, string Status);

// src/Application/Stores/IWarehouseService.cs
namespace Ordina.Application.Stores;

public interface IWarehouseService
{
    Task<IReadOnlyList<WarehouseDto>> GetAllAsync(CancellationToken ct = default);
    Task<WarehouseDto?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<WarehouseDto> CreateAsync(CreateWarehouseDto dto, CancellationToken ct = default);
    Task<WarehouseDto?> UpdateAsync(string id, UpdateWarehouseDto dto, CancellationToken ct = default);
    Task<bool> DeleteAsync(string id, CancellationToken ct = default);
}

// src/Application/Stores/WarehouseService.cs
using Ordina.Domain.Stores;
using Ordina.Infrastructure.Repositories;

namespace Ordina.Application.Stores;

public class WarehouseService(IMongoRepository<Warehouse> warehouseRepo) : IWarehouseService
{
    public async Task<IReadOnlyList<WarehouseDto>> GetAllAsync(CancellationToken ct = default)
    {
        var list = await warehouseRepo.GetAllAsync(ct);
        return list.Select(MapToDto).ToList();
    }

    public async Task<WarehouseDto?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        var item = await warehouseRepo.GetByIdAsync(id, ct);
        return item == null ? null : MapToDto(item);
    }

    public async Task<WarehouseDto> CreateAsync(CreateWarehouseDto dto, CancellationToken ct = default)
    {
        var entity = new Warehouse
        {
            Name = dto.Name.Trim(),
            Code = dto.Code.Trim().ToUpperInvariant(),
            Address = dto.Address.Trim(),
            Phone = dto.Phone.Trim(),
            MaxCapacity = Math.Max(1, dto.MaxCapacity),
            IsCentral = dto.IsCentral,
            Status = "active"
        };
        await warehouseRepo.InsertAsync(entity, ct);
        return MapToDto(entity);
    }

    public async Task<WarehouseDto?> UpdateAsync(string id, UpdateWarehouseDto dto, CancellationToken ct = default)
    {
        var entity = await warehouseRepo.GetByIdAsync(id, ct);
        if (entity == null) return null;

        entity.Name = dto.Name.Trim();
        entity.Code = dto.Code.Trim().ToUpperInvariant();
        entity.Address = dto.Address.Trim();
        entity.Phone = dto.Phone.Trim();
        entity.MaxCapacity = Math.Max(1, dto.MaxCapacity);
        entity.IsCentral = dto.IsCentral;
        entity.Status = dto.Status;

        await warehouseRepo.UpdateAsync(entity, ct);
        return MapToDto(entity);
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken ct = default)
    {
        var entity = await warehouseRepo.GetByIdAsync(id, ct);
        if (entity == null) return false;
        entity.Status = "inactive";
        await warehouseRepo.UpdateAsync(entity, ct);
        return true;
    }

    private static WarehouseDto MapToDto(Warehouse w) =>
        new(w.Id ?? string.Empty, w.Name, w.Code, w.Address, w.Phone, w.MaxCapacity, w.IsCentral, w.Status);
}
```

- [ ] **Step 4: Create WarehousesController and register DI**

```csharp
// src/Api/Controllers/WarehousesController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Stores;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WarehousesController(IWarehouseService warehouseService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<WarehouseDto>>> GetAll(CancellationToken ct) =>
        Ok(await warehouseService.GetAllAsync(ct));

    [HttpGet("{id}")]
    public async Task<ActionResult<WarehouseDto>> GetById(string id, CancellationToken ct)
    {
        var res = await warehouseService.GetByIdAsync(id, ct);
        return res != null ? Ok(res) : NotFound();
    }

    [HttpPost]
    public async Task<ActionResult<WarehouseDto>> Create([FromBody] CreateWarehouseDto dto, CancellationToken ct) =>
        Ok(await warehouseService.CreateAsync(dto, ct));

    [HttpPut("{id}")]
    public async Task<ActionResult<WarehouseDto>> Update(string id, [FromBody] UpdateWarehouseDto dto, CancellationToken ct)
    {
        var res = await warehouseService.UpdateAsync(id, dto, ct);
        return res != null ? Ok(res) : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct) =>
        await warehouseService.DeleteAsync(id, ct) ? NoContent() : NotFound();
}
```

- [ ] **Step 5: Run tests and verify they pass**

Run: `dotnet test --filter "FullyQualifiedName~WarehouseServiceTests"`
Expected: PASS 1 test.

- [ ] **Step 6: Commit**

```bash
git add src/Domain/Stores/ src/Application/Stores/ src/Api/Controllers/WarehousesController.cs src/Infrastructure/DependencyInjection.cs tests/Ordina.Application.Tests/WarehouseServiceTests.cs
git commit -m "feat(stock): add warehouse entity, service, and store maxCapacity property"
```

---

### Task 2: PhysicalStock & StockReservation Domain Entities and Repositories (Backend)

**Files:**
- Create: `src/Domain/Inventory/PhysicalStock.cs`
- Create: `src/Domain/Inventory/StockReservation.cs`
- Create: `src/Domain/Inventory/IPhysicalStockRepository.cs`
- Create: `src/Infrastructure/Repositories/PhysicalStockRepository.cs`
- Modify: `src/Infrastructure/DependencyInjection.cs`

**Interfaces:**
- Produces:
  - `PhysicalStock`: `ProductId`, `ProductName`, `Sku`, `CategoryId`, `CategoryName`, `LocationType`, `LocationId`, `LocationName`, `Attributes`, `VariantKey`, `Quantity`, `ReservedQuantity`, `AvailableQuantity`, `PriceUsd`, `CostUsd`.
  - `StockReservation`: `StockId`, `ProductId`, `ProductName`, `LocationId`, `LocationName`, `VendorId`, `VendorName`, `Quantity`, `ReservationType`, `OrderNumber`, `ExpiresAt`, `Status`.
  - `IPhysicalStockRepository.ReserveStockAtomicAsync(string stockId, int qty) -> Task<bool>`
  - `IPhysicalStockRepository.ReleaseStockAtomicAsync(string stockId, int qty) -> Task<bool>`
  - `IPhysicalStockRepository.DeductSoldStockAtomicAsync(string stockId, int qty) -> Task<bool>`

- [ ] **Step 1: Write entities in Domain/Inventory**

```csharp
// src/Domain/Inventory/PhysicalStock.cs
using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Inventory;

public class PhysicalStock : BaseEntity
{
    [BsonElement("productId")]
    public string ProductId { get; set; } = string.Empty;

    [BsonElement("productName")]
    public string ProductName { get; set; } = string.Empty;

    [BsonElement("sku")]
    public string Sku { get; set; } = string.Empty;

    [BsonElement("categoryId")]
    public string CategoryId { get; set; } = string.Empty;

    [BsonElement("categoryName")]
    public string CategoryName { get; set; } = string.Empty;

    [BsonElement("locationType")]
    public string LocationType { get; set; } = "store"; // "store" | "warehouse"

    [BsonElement("locationId")]
    public string LocationId { get; set; } = string.Empty;

    [BsonElement("locationName")]
    public string LocationName { get; set; } = string.Empty;

    [BsonElement("attributes")]
    public Dictionary<string, string> Attributes { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    [BsonElement("variantKey")]
    public string VariantKey { get; set; } = string.Empty;

    [BsonElement("quantity")]
    public int Quantity { get; set; } = 0;

    [BsonElement("reservedQuantity")]
    public int ReservedQuantity { get; set; } = 0;

    [BsonIgnore]
    public int AvailableQuantity => Math.Max(0, Quantity - ReservedQuantity);

    [BsonElement("priceUsd")]
    public decimal PriceUsd { get; set; } = 0m;

    [BsonElement("costUsd")]
    public decimal CostUsd { get; set; } = 0m;

    public static string BuildVariantKey(Dictionary<string, string>? attrs)
    {
        if (attrs == null || attrs.Count == 0) return "standard";
        return string.Join("|", attrs.OrderBy(kv => kv.Key).Select(kv => $"{kv.Key.Trim().ToLowerInvariant()}:{kv.Value.Trim().ToLowerInvariant()}"));
    }
}

// src/Domain/Inventory/StockReservation.cs
using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Inventory;

public class StockReservation : BaseEntity
{
    [BsonElement("stockId")]
    public string StockId { get; set; } = string.Empty;

    [BsonElement("productId")]
    public string ProductId { get; set; } = string.Empty;

    [BsonElement("productName")]
    public string ProductName { get; set; } = string.Empty;

    [BsonElement("locationId")]
    public string LocationId { get; set; } = string.Empty;

    [BsonElement("locationName")]
    public string LocationName { get; set; } = string.Empty;

    [BsonElement("vendorId")]
    public string VendorId { get; set; } = string.Empty;

    [BsonElement("vendorName")]
    public string VendorName { get; set; } = string.Empty;

    [BsonElement("quantity")]
    public int Quantity { get; set; } = 1;

    [BsonElement("reservationType")]
    public string ReservationType { get; set; } = "counter"; // "counter" (10m) | "formal" (30m)

    [BsonElement("orderNumber")]
    public string? OrderNumber { get; set; }

    [BsonElement("expiresAt")]
    public DateTime ExpiresAt { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = "active"; // "active" | "released" | "converted"
}
```

- [ ] **Step 2: Create IPhysicalStockRepository with atomic MongoDB operations**

```csharp
// src/Domain/Inventory/IPhysicalStockRepository.cs
using Ordina.Infrastructure.Repositories;

namespace Ordina.Domain.Inventory;

public interface IPhysicalStockRepository : IMongoRepository<PhysicalStock>
{
    Task<bool> ReserveStockAtomicAsync(string stockId, int quantity, CancellationToken ct = default);
    Task<bool> ReleaseStockAtomicAsync(string stockId, int quantity, CancellationToken ct = default);
    Task<bool> DeductSoldStockAtomicAsync(string stockId, int quantity, CancellationToken ct = default);
}

// src/Infrastructure/Repositories/PhysicalStockRepository.cs
using MongoDB.Driver;
using Ordina.Domain.Inventory;
using Ordina.Infrastructure.Data;

namespace Ordina.Infrastructure.Repositories;

public class PhysicalStockRepository(MongoDbContext context) : MongoRepository<PhysicalStock>(context, "physical_stocks"), IPhysicalStockRepository
{
    public async Task<bool> ReserveStockAtomicAsync(string stockId, int quantity, CancellationToken ct = default)
    {
        var filter = Builders<PhysicalStock>.Filter.Where(s => s.Id == stockId && (s.Quantity - s.ReservedQuantity) >= quantity);
        var update = Builders<PhysicalStock>.Update.Inc(s => s.ReservedQuantity, quantity).Set(s => s.UpdatedAt, DateTime.UtcNow);
        var res = await Collection.UpdateOneAsync(filter, update, cancellationToken: ct);
        return res.ModifiedCount > 0;
    }

    public async Task<bool> ReleaseStockAtomicAsync(string stockId, int quantity, CancellationToken ct = default)
    {
        var filter = Builders<PhysicalStock>.Filter.Eq(s => s.Id, stockId);
        var update = Builders<PhysicalStock>.Update.Inc(s => s.ReservedQuantity, -quantity).Set(s => s.UpdatedAt, DateTime.UtcNow);
        var res = await Collection.UpdateOneAsync(filter, update, cancellationToken: ct);
        return res.ModifiedCount > 0;
    }

    public async Task<bool> DeductSoldStockAtomicAsync(string stockId, int quantity, CancellationToken ct = default)
    {
        var filter = Builders<PhysicalStock>.Filter.Eq(s => s.Id, stockId);
        var update = Builders<PhysicalStock>.Update.Inc(s => s.Quantity, -quantity).Inc(s => s.ReservedQuantity, -quantity).Set(s => s.UpdatedAt, DateTime.UtcNow);
        var res = await Collection.UpdateOneAsync(filter, update, cancellationToken: ct);
        return res.ModifiedCount > 0;
    }
}
```

- [ ] **Step 3: Register in DependencyInjection.cs and build**

Register repository in `DependencyInjection.cs`:
```csharp
services.AddScoped<IPhysicalStockRepository, PhysicalStockRepository>();
services.AddScoped<IMongoRepository<StockReservation>>(sp => new MongoRepository<StockReservation>(sp.GetRequiredService<MongoDbContext>(), "stock_reservations"));
```
Run: `dotnet build`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/Domain/Inventory/ src/Infrastructure/Repositories/PhysicalStockRepository.cs src/Infrastructure/DependencyInjection.cs
git commit -m "feat(stock): create physical stock and reservation entities and atomic repository"
```

---

### Task 3: PhysicalStock Management, Manual Entry & Excel Import Services (Backend)

**Files:**
- Create: `src/Application/Inventory/PhysicalStockDtos.cs`
- Create: `src/Application/Inventory/IPhysicalStockService.cs`
- Create: `src/Application/Inventory/PhysicalStockService.cs`
- Create: `src/Api/Controllers/StockController.cs`
- Test: `tests/Ordina.Application.Tests/PhysicalStockServiceTests.cs`

**Interfaces:**
- Produces:
  - `GET /api/stock` (filtros: locationId, categoryId, search, onlyAvailable)
  - `POST /api/stock/manual-entry`
  - `POST /api/stock/import-excel`
  - `GET /api/stock/import-template`
  - `IPhysicalStockService.GetStockListAsync(...)`
  - `IPhysicalStockService.AddManualStockAsync(ManualStockEntryDto) -> Task<PhysicalStockDto>`
  - `IPhysicalStockService.ImportExcelAsync(Stream fileStream) -> Task<StockImportSummaryDto>`
  - `IPhysicalStockService.GenerateExcelTemplateAsync() -> byte[]`

- [ ] **Step 1: Write failing test for PhysicalStockService**

```csharp
// tests/Ordina.Application.Tests/PhysicalStockServiceTests.cs
using FluentAssertions;
using Moq;
using Ordina.Application.Inventory;
using Ordina.Domain.Catalog;
using Ordina.Domain.Inventory;
using Ordina.Domain.Stores;
using Ordina.Infrastructure.Repositories;
using Xunit;

namespace Ordina.Application.Tests;

public class PhysicalStockServiceTests
{
    private readonly Mock<IPhysicalStockRepository> _stockRepoMock = new();
    private readonly Mock<IProductRepository> _prodRepoMock = new();
    private readonly Mock<IMongoRepository<Store>> _storeRepoMock = new();
    private readonly Mock<IMongoRepository<Warehouse>> _warehouseRepoMock = new();
    private readonly PhysicalStockService _service;

    public PhysicalStockServiceTests()
    {
        _service = new PhysicalStockService(
            _stockRepoMock.Object,
            _prodRepoMock.Object,
            _storeRepoMock.Object,
            _warehouseRepoMock.Object);
    }

    [Fact]
    public async Task AddManualStock_ValidInput_CreatesStockItem()
    {
        var product = new Product { Name = "Cama Turín", SKU = "TUR-01", Category = "Camas", Price = 300 };
        product.Id = "prod-1";
        _prodRepoMock.Setup(r => r.GetByIdAsync("prod-1", default)).ReturnsAsync(product);

        var store = new Store { Name = "Tienda Guatire" };
        store.Id = "store-1";
        _storeRepoMock.Setup(r => r.GetByIdAsync("store-1", default)).ReturnsAsync(store);

        var dto = new ManualStockEntryDto(
            ProductId: "prod-1",
            LocationType: "store",
            LocationId: "store-1",
            Attributes: new Dictionary<string, string> { { "Tela", "Lino" }, { "Color", "Gris" } },
            Quantity: 2,
            CostUsd: 150m,
            PriceUsd: 300m,
            Note: "Lote taller 1"
        );

        _stockRepoMock.Setup(r => r.InsertAsync(It.IsAny<PhysicalStock>(), default)).Returns(Task.CompletedTask);

        var res = await _service.AddManualStockAsync(dto);

        res.Should().NotBeNull();
        res.ProductName.Should().Be("Cama Turín");
        res.Quantity.Should().Be(2);
        res.LocationName.Should().Be("Tienda Guatire");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test --filter "FullyQualifiedName~PhysicalStockServiceTests"`
Expected: FAIL.

- [ ] **Step 3: Implement PhysicalStockService & ClosedXML Excel Import**

```csharp
// src/Application/Inventory/PhysicalStockDtos.cs
namespace Ordina.Application.Inventory;

public record PhysicalStockDto(
    string Id,
    string ProductId,
    string ProductName,
    string Sku,
    string CategoryId,
    string CategoryName,
    string LocationType,
    string LocationId,
    string LocationName,
    Dictionary<string, string> Attributes,
    string VariantKey,
    int Quantity,
    int ReservedQuantity,
    int AvailableQuantity,
    decimal PriceUsd,
    decimal CostUsd,
    DateTime UpdatedAt);

public record ManualStockEntryDto(
    string ProductId,
    string LocationType,
    string LocationId,
    Dictionary<string, string> Attributes,
    int Quantity,
    decimal CostUsd,
    decimal PriceUsd,
    string? Note);

public record StockImportSummaryDto(int TotalRows, int CreatedCount, int UpdatedCount, List<string> Errors);
```

Implement `PhysicalStockService.cs` with `AddManualStockAsync`, `GetStockListAsync`, `ImportExcelAsync` (using `ClosedXML.Excel.XLWorkbook`), and `GenerateExcelTemplateAsync`.

- [ ] **Step 4: Create StockController**

Create `src/Api/Controllers/StockController.cs` exposing `GET /api/stock`, `POST /api/stock/manual-entry`, `POST /api/stock/import-excel`, `GET /api/stock/import-template`.

- [ ] **Step 5: Run tests and verify they pass**

Run: `dotnet test --filter "FullyQualifiedName~PhysicalStockServiceTests"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/Application/Inventory/ src/Api/Controllers/StockController.cs tests/Ordina.Application.Tests/PhysicalStockServiceTests.cs
git commit -m "feat(stock): add physical stock service, manual entry, and ClosedXML excel import"
```

---

### Task 4: Anti-Duplicity Temporary Reservation Engine & Background Cleanup Worker (Backend)

**Files:**
- Create: `src/Application/Inventory/StockReservationDtos.cs`
- Create: `src/Application/Inventory/IStockReservationService.cs`
- Create: `src/Application/Inventory/StockReservationService.cs`
- Create: `src/Application/Inventory/StockReservationCleanupWorker.cs`
- Modify: `src/Api/Controllers/StockController.cs`
- Modify: `src/Infrastructure/DependencyInjection.cs`
- Test: `tests/Ordina.Application.Tests/StockReservationServiceTests.cs`

**Interfaces:**
- Produces:
  - `POST /api/stock/reservations` -> `ReserveItemAsync(CreateStockReservationDto)` (10m counter timeout).
  - `PUT /api/stock/reservations/{id}/extend` -> `ExtendReservationAsync(string id, string orderNumber)` (extends to 30m).
  - `POST /api/stock/reservations/{id}/release` -> `ReleaseReservationAsync(string id)` (restores stock immediately).
  - Background worker: checks expired active reservations every 60s and restores stock.

- [ ] **Step 1: Write failing test for StockReservationService**

```csharp
// tests/Ordina.Application.Tests/StockReservationServiceTests.cs
using FluentAssertions;
using Moq;
using Ordina.Application.Inventory;
using Ordina.Domain.Inventory;
using Ordina.Infrastructure.Repositories;
using Xunit;

namespace Ordina.Application.Tests;

public class StockReservationServiceTests
{
    private readonly Mock<IPhysicalStockRepository> _stockRepoMock = new();
    private readonly Mock<IMongoRepository<StockReservation>> _resRepoMock = new();
    private readonly StockReservationService _service;

    public StockReservationServiceTests()
    {
        _service = new StockReservationService(_stockRepoMock.Object, _resRepoMock.Object);
    }

    [Fact]
    public async Task ReserveItem_WhenAvailable_LocksStockAndReturnsReservation()
    {
        var stock = new PhysicalStock { ProductName = "Cama Turín", Quantity = 2, ReservedQuantity = 0, LocationId = "loc-1", LocationName = "Guatire" };
        stock.Id = "stock-1";
        _stockRepoMock.Setup(r => r.GetByIdAsync("stock-1", default)).ReturnsAsync(stock);
        _stockRepoMock.Setup(r => r.ReserveStockAtomicAsync("stock-1", 1, default)).ReturnsAsync(true);
        _resRepoMock.Setup(r => r.InsertAsync(It.IsAny<StockReservation>(), default)).Returns(Task.CompletedTask);

        var dto = new CreateStockReservationDto("stock-1", "user-1", "Vendedor Juan", 1, "counter");
        var res = await _service.ReserveItemAsync(dto);

        res.Should().NotBeNull();
        res.Status.Should().Be("active");
        res.ExpiresAt.Should().BeAfter(DateTime.UtcNow.AddMinutes(9));
    }

    [Fact]
    public async Task ReserveItem_WhenConcurrentLockFails_ThrowsInvalidOperationException()
    {
        _stockRepoMock.Setup(r => r.ReserveStockAtomicAsync("stock-1", 1, default)).ReturnsAsync(false);

        var dto = new CreateStockReservationDto("stock-1", "user-2", "Vendedor Pedro", 1, "counter");
        var act = async () => await _service.ReserveItemAsync(dto);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*no tiene disponibilidad suficiente*");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test --filter "FullyQualifiedName~StockReservationServiceTests"`
Expected: FAIL.

- [ ] **Step 3: Implement StockReservationService & CleanupWorker**

Implement atomic reservation logic in `StockReservationService.cs` and `StockReservationCleanupWorker : BackgroundService`.

- [ ] **Step 4: Register BackgroundWorker in DI and run tests**

Register in `DependencyInjection.cs`:
```csharp
services.AddScoped<IStockReservationService, StockReservationService>();
services.AddHostedService<StockReservationCleanupWorker>();
```
Run: `dotnet test --filter "FullyQualifiedName~StockReservationServiceTests"`
Expected: PASS 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/Application/Inventory/ src/Api/Controllers/StockController.cs src/Infrastructure/DependencyInjection.cs tests/Ordina.Application.Tests/StockReservationServiceTests.cs
git commit -m "feat(stock): implement anti-duplicity stock reservation engine and cleanup worker"
```

---

### Task 5: Frontend Store MaxCapacity & Warehouse Management UI

**Files:**
- Modify: `Ordina.Frontend/src/lib/api-client.ts`
- Modify: `Ordina.Frontend/src/lib/storage.ts`
- Modify: `Ordina.Frontend/src/components/stores/stores-page.tsx`
- Create: `Ordina.Frontend/src/components/stores/warehouses-dialog.tsx`

- [ ] **Step 1: Update API Client with warehouse endpoints and Store.maxCapacity**

Add `Warehouse` type and `getWarehouses`, `createWarehouse`, `updateWarehouse`, `deleteWarehouse` in `api-client.ts`. Update `Store` interface to include `maxCapacity?: number`.

- [ ] **Step 2: Update StoresPage form & table with maxCapacity**

Add "Tope de Exhibición / Capacidad Máxima" input field in `stores-page.tsx` creation and edit dialogs. Add a column in the stores table displaying `store.maxCapacity ?? 25`.

- [ ] **Step 3: Add button & dialog for managing Warehouses (Terrinca)**

Add "Gestionar Almacenes" button on `StoresPage` opening `WarehousesDialog` to view, create, and edit warehouses.

- [ ] **Step 4: Verify frontend build**

Run: `npm run build` in `Ordina.Frontend`
Expected: Build passes with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add Ordina.Frontend/src/lib/api-client.ts Ordina.Frontend/src/lib/storage.ts Ordina.Frontend/src/components/stores/
git commit -m "feat(stores): add store maxCapacity setting and warehouse management dialog"
```

---

### Task 6: Frontend Stock Consulta Interactiva (`/inventario/existencias`) & Excel Import UI

**Files:**
- Modify: `Ordina.Frontend/src/lib/api-client.ts`
- Create: `Ordina.Frontend/src/components/inventory/stock-list-page.tsx`
- Create: `Ordina.Frontend/src/components/inventory/stock-import-dialog.tsx`
- Create: `Ordina.Frontend/src/components/inventory/manual-entry-dialog.tsx`
- Create: `Ordina.Frontend/src/app/inventario/existencias/page.tsx`
- Modify: `Ordina.Frontend/src/components/dashboard/sidebar.tsx`

- [ ] **Step 1: Add Stock API client methods**

In `api-client.ts`, add:
- `getStockList(params)`
- `addManualStock(dto)`
- `importStockExcel(formData)`
- `downloadStockTemplate()`

- [ ] **Step 2: Build StockListPage component**

Build `StockListPage` with:
- Top stats: Total stock físico, Piezas disponibles, Piezas apartadas.
- Filters: Sede selector, Category selector, text search, "Solo disponibles" toggle.
- Clean responsive grid of stock items with badges for location, variant (fabric, color, size), and availability badge.

- [ ] **Step 3: Build StockImportDialog and ManualEntryDialog**

- `StockImportDialog`: File drag-and-drop for `.xlsx`, "Descargar Plantilla" button, upload progress and summary report.
- `ManualEntryDialog`: Select sede, autocomplete product, enter attributes (fabric, color, size), quantity, cost, price, and reception note.

- [ ] **Step 4: Create route `/inventario/existencias` and add to sidebar**

Add navigation item "Existencias Inmediatas" under the "Inventario" section in `sidebar.tsx`.

- [ ] **Step 5: Verify build**

Run: `npm run build` in `Ordina.Frontend`
Expected: Build passes with 0 errors.

- [ ] **Step 6: Commit**

```bash
git add Ordina.Frontend/src/lib/api-client.ts Ordina.Frontend/src/components/inventory/ Ordina.Frontend/src/app/inventario/existencias/ Ordina.Frontend/src/components/dashboard/sidebar.tsx
git commit -m "feat(inventory): add interactive stock view, manual entry and excel import dialogs"
```

---

### Task 7: Frontend Temporary Reservation (Anti-Duplicidad) UI with Live Countdown Timer

**Files:**
- Modify: `Ordina.Frontend/src/components/inventory/stock-list-page.tsx`
- Create: `Ordina.Frontend/src/components/inventory/reservation-countdown-pill.tsx`
- Modify: `Ordina.Frontend/src/lib/api-client.ts`

- [ ] **Step 1: Add reservation methods to api-client**

In `api-client.ts`:
- `reserveStockItem(dto)`
- `releaseStockReservation(id)`
- `extendStockReservation(id, orderNumber)`

- [ ] **Step 2: Build ReservationCountdownPill component**

Component that takes `expiresAt: string`, displays live ticking countdown `mm:ss`, and turns amber/red when expiring in <2 minutes. Fires `onExpired` callback when time reaches 00:00.

- [ ] **Step 3: Integrate reservation actions into Stock card**

- If available: *"Apartar en Mostrador (10 min)"* button.
- If user holds the active reservation: Shows countdown pill + *"Continuar a Pedido"* button + *"Liberar"* button.
- If held by another user: Shows amber badge *"Apartado por [Nombre] (expira en mm:ss)"* and disables action.
- *"Continuar a Pedido"* navigates to `/pedidos/nuevo` with product and variant pre-selected.

- [ ] **Step 4: Verify build**

Run: `npm run build` in `Ordina.Frontend`
Expected: Build passes with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add Ordina.Frontend/src/components/inventory/ Ordina.Frontend/src/lib/api-client.ts
git commit -m "feat(inventory): add live anti-duplicity countdown reservation in stock view"
```

---

### Task 8: End-to-end Integration, BI Connection & Verification

**Files:**
- Modify: `src/Application/Dashboard/DashboardService.cs:1747-1818`
- Test: `tests/Ordina.Application.Tests/DashboardComprehensiveBiTests.cs`

- [ ] **Step 1: Connect real PhysicalStock to Dashboard BI metrics**

Update `DashboardService.cs`:
- In `GetStoreOccupancyAsync`: Calculate real occupancy using `PhysicalStock` items count divided by `Store.MaxCapacity` (instead of the hardcoded 60%).
- In `GetReplenishmentSuggestionsAsync`: Query real stock in Terrinca and Store from `PhysicalStock` (replacing the simulated `5 - rank` formula).
- In `GetStockTurnoverAsync`: Query real active units from `PhysicalStock`.

- [ ] **Step 2: Run all backend tests**

Run: `dotnet test`
Expected: All tests pass.

- [ ] **Step 3: Run full frontend build**

Run: `npm run build` in `Ordina.Frontend`
Expected: Exits with code 0.

- [ ] **Step 4: Commit**

```bash
git add src/Application/Dashboard/DashboardService.cs tests/Ordina.Application.Tests/DashboardComprehensiveBiTests.cs
git commit -m "feat(bi): connect store occupancy and replenishment suggestions to real physical stock"
```
