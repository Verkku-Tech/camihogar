using Moq;
using Ordina.Application.Common;
using Ordina.Application.Inventory;
using Ordina.Domain.Catalog;
using Ordina.Domain.Inventory;
using Ordina.Domain.Stores;
using Xunit;

namespace Ordina.Application.Tests;

public class PhysicalStockServiceTests
{
    private readonly Mock<IPhysicalStockRepository> _stockRepoMock = new();
    private readonly Mock<IProductRepository> _prodRepoMock = new();
    private readonly Mock<IRepository<Store>> _storeRepoMock = new();
    private readonly Mock<IRepository<Warehouse>> _warehouseRepoMock = new();
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
        var product = new Product { Name = "Cama Turín", SKU = "TUR-01", Category = "Camas", Price = 300m };
        product.Id = "66f000000000000000000001";
        _prodRepoMock.Setup(r => r.GetByIdAsync("66f000000000000000000001", default)).ReturnsAsync(product);

        var store = new Store { Name = "Tienda Guatire" };
        store.Id = "66f000000000000000000002";
        _storeRepoMock.Setup(r => r.GetByIdAsync("66f000000000000000000002", default)).ReturnsAsync(store);

        _stockRepoMock.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<System.Func<PhysicalStock, bool>>>(), default))
            .ReturnsAsync(new List<PhysicalStock>());

        _stockRepoMock.Setup(r => r.AddAsync(It.IsAny<PhysicalStock>(), default))
            .ReturnsAsync((PhysicalStock s, CancellationToken _) =>
            {
                s.Id = "66f000000000000000000003";
                return s;
            });

        var dto = new ManualStockEntryDto(
            ProductId: "66f000000000000000000001",
            LocationType: "store",
            LocationId: "66f000000000000000000002",
            Attributes: new Dictionary<string, string> { { "Tela", "Lino" }, { "Color", "Gris" } },
            Quantity: 2,
            CostUsd: 150m,
            PriceUsd: 300m,
            Note: "Lote taller 1"
        );

        var res = await _service.AddManualStockAsync(dto);

        Assert.NotNull(res);
        Assert.Equal("Cama Turín", res.ProductName);
        Assert.Equal(2, res.Quantity);
        Assert.Equal("Tienda Guatire", res.LocationName);
        Assert.Equal(2, res.AvailableQuantity);
    }

    [Fact]
    public async Task AddManualStock_ExistingVariant_IncrementsQuantity()
    {
        var product = new Product { Name = "Cama Turín", SKU = "TUR-01", Category = "Camas", Price = 300m };
        product.Id = "66f000000000000000000001";
        _prodRepoMock.Setup(r => r.GetByIdAsync("66f000000000000000000001", default)).ReturnsAsync(product);

        var warehouse = new Warehouse { Name = "Depósito Terrinca", Code = "TERR-01" };
        warehouse.Id = "66f000000000000000000005";
        _warehouseRepoMock.Setup(r => r.GetByIdAsync("66f000000000000000000005", default)).ReturnsAsync(warehouse);

        var existingStock = new PhysicalStock
        {
            Id = "66f000000000000000000006",
            ProductId = "66f000000000000000000001",
            ProductName = "Cama Turín",
            LocationType = "warehouse",
            LocationId = "66f000000000000000000005",
            LocationName = "Depósito Terrinca",
            VariantKey = "color:azul|tela:terciopelo",
            Quantity = 3,
            ReservedQuantity = 0,
            PriceUsd = 320m,
            CostUsd = 160m
        };

        _stockRepoMock.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<System.Func<PhysicalStock, bool>>>(), default))
            .ReturnsAsync(new List<PhysicalStock> { existingStock });

        _stockRepoMock.Setup(r => r.UpdateAsync(It.IsAny<PhysicalStock>(), default))
            .ReturnsAsync(true);

        var dto = new ManualStockEntryDto(
            ProductId: "66f000000000000000000001",
            LocationType: "warehouse",
            LocationId: "66f000000000000000000005",
            Attributes: new Dictionary<string, string> { { "color", "azul" }, { "tela", "terciopelo" } },
            Quantity: 4,
            CostUsd: 160m,
            PriceUsd: 320m,
            Note: "Reposición"
        );

        var res = await _service.AddManualStockAsync(dto);

        Assert.NotNull(res);
        Assert.Equal(7, res.Quantity);
        Assert.Equal("Depósito Terrinca", res.LocationName);
    }

    [Fact]
    public async Task GenerateExcelTemplate_ReturnsValidBytes()
    {
        var bytes = await _service.GenerateExcelTemplateAsync();

        Assert.NotNull(bytes);
        Assert.True(bytes.Length > 0);
    }
}
