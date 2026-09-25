using System.Linq.Expressions;
using Moq;
using Ordina.Application.Common;
using Ordina.Application.Inventory;
using Ordina.Application.Manufacturing;
using Ordina.Domain.Inventory;
using Ordina.Domain.Manufacturing;
using Xunit;

namespace Ordina.Application.Tests;

public class ManufacturingOrderServiceTests
{
    private readonly Mock<IRepository<ManufacturingOrder>> _orderRepoMock = new();
    private readonly Mock<IPhysicalStockRepository> _stockRepoMock = new();
    private readonly ManufacturingOrderService _service;

    public ManufacturingOrderServiceTests()
    {
        _service = new ManufacturingOrderService(_orderRepoMock.Object, _stockRepoMock.Object);
    }

    [Fact]
    public async Task CreateOrder_GeneratesCorrelativeOFAndSaves()
    {
        _orderRepoMock.Setup(r => r.GetAllAsync(default))
            .ReturnsAsync(new List<ManufacturingOrder>());

        _orderRepoMock.Setup(r => r.AddAsync(It.IsAny<ManufacturingOrder>(), default))
            .ReturnsAsync((ManufacturingOrder o, CancellationToken _) =>
            {
                o.Id = "mfg-01";
                return o;
            });

        var dto = new CreateManufacturingOrderDto(
            ProductId: "prod-01",
            ProductName: "Sofá Roma 3 Puestos",
            Sku: "SOF-ROM-3P",
            Attributes: new Dictionary<string, string> { { "Color", "Gris Plomo" } },
            Quantity: 3,
            DestinationLocationId: "terrinca",
            DestinationLocationName: "Depósito Terrinca",
            DestinationLocationType: "warehouse",
            RequestedBy: "Gerente Producción",
            ProviderId: "prov-01",
            ProviderName: "Taller Central",
            CostUsd: 150m,
            Notes: "Stock de reposición para tope"
        );

        var result = await _service.CreateAsync(dto);

        Assert.NotNull(result);
        Assert.StartsWith("OF-", result.OrderNumber);
        Assert.Equal("StockReplenishment", result.OrderType);
        Assert.Equal("Pendiente", result.Status);
        Assert.Equal("Gerente Producción", result.RequestedBy);
        Assert.Equal(3, result.Quantity);
    }

    [Fact]
    public async Task UpdateStatus_ToFabricado_CreditsPhysicalStockInDestination()
    {
        var existingOrder = new ManufacturingOrder
        {
            Id = "mfg-01",
            OrderNumber = "OF-0001",
            ProductId = "prod-01",
            ProductName = "Sofá Roma",
            Sku = "SOF-ROM",
            Attributes = new Dictionary<string, string> { { "Color", "Azul" } },
            Quantity = 2,
            DestinationLocationId = "guatire",
            DestinationLocationName = "Tienda Guatire",
            DestinationLocationType = "store",
            Status = "En Produccion"
        };

        var existingStock = new PhysicalStock
        {
            Id = "stk-01",
            ProductId = "prod-01",
            LocationId = "guatire",
            VariantKey = "Color:Azul",
            Quantity = 1,
            ReservedQuantity = 0
        };

        _orderRepoMock.Setup(r => r.GetByIdAsync("mfg-01", default))
            .ReturnsAsync(existingOrder);
        _stockRepoMock.Setup(r => r.FindAsync(It.IsAny<Expression<Func<PhysicalStock, bool>>>(), default))
            .ReturnsAsync(new List<PhysicalStock> { existingStock });
        _stockRepoMock.Setup(r => r.UpdateAsync(It.IsAny<PhysicalStock>(), default))
            .ReturnsAsync(true);
        _orderRepoMock.Setup(r => r.UpdateAsync(It.IsAny<ManufacturingOrder>(), default))
            .ReturnsAsync(true);

        var updateDto = new UpdateManufacturingOrderStatusDto("Fabricado");
        var result = await _service.UpdateStatusAsync("mfg-01", updateDto);

        Assert.NotNull(result);
        Assert.Equal("Fabricado", result.Status);
        Assert.NotNull(result.CompletedAt);
        Assert.Equal(3, existingStock.Quantity); // 1 + 2
        _stockRepoMock.Verify(r => r.UpdateAsync(existingStock, default), Times.Once);
    }

    [Fact]
    public async Task UpdateStatus_ToEnProduccion_SetsStartedAt()
    {
        var existingOrder = new ManufacturingOrder
        {
            Id = "mfg-02",
            OrderNumber = "OF-0002",
            ProductId = "prod-02",
            ProductName = "Poltrona Relax",
            Quantity = 1,
            Status = "Pendiente"
        };

        _orderRepoMock.Setup(r => r.GetByIdAsync("mfg-02", default))
            .ReturnsAsync(existingOrder);
        _orderRepoMock.Setup(r => r.UpdateAsync(It.IsAny<ManufacturingOrder>(), default))
            .ReturnsAsync(true);

        var updateDto = new UpdateManufacturingOrderStatusDto("En Produccion");
        var result = await _service.UpdateStatusAsync("mfg-02", updateDto);

        Assert.NotNull(result);
        Assert.Equal("En Produccion", result.Status);
        Assert.NotNull(result.StartedAt);
    }

    [Fact]
    public async Task Cancel_PendingOrder_SetsStatusCancelled()
    {
        var existingOrder = new ManufacturingOrder
        {
            Id = "mfg-03",
            OrderNumber = "OF-0003",
            Status = "Pendiente"
        };

        _orderRepoMock.Setup(r => r.GetByIdAsync("mfg-03", default))
            .ReturnsAsync(existingOrder);
        _orderRepoMock.Setup(r => r.UpdateAsync(It.IsAny<ManufacturingOrder>(), default))
            .ReturnsAsync(true);

        var ok = await _service.CancelAsync("mfg-03");

        Assert.True(ok);
        Assert.Equal("Cancelado", existingOrder.Status);
    }
}
