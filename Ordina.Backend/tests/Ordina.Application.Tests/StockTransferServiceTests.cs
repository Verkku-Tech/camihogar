using System.Linq.Expressions;
using Moq;
using Ordina.Application.Common;
using Ordina.Application.Inventory;
using Ordina.Domain.Inventory;
using Xunit;

namespace Ordina.Application.Tests;

public class StockTransferServiceTests
{
    private readonly Mock<IPhysicalStockRepository> _stockRepoMock = new();
    private readonly Mock<IRepository<StockTransfer>> _transferRepoMock = new();
    private readonly StockTransferService _service;

    public StockTransferServiceTests()
    {
        _service = new StockTransferService(_stockRepoMock.Object, _transferRepoMock.Object);
    }

    [Fact]
    public async Task CreateTransfer_WhenValid_ReservesOriginStockAndCreatesInTransitTransfer()
    {
        var originStock = new PhysicalStock
        {
            Id = "stk-01",
            ProductId = "prod-01",
            ProductName = "Cama Turín",
            Sku = "CAM-TUR",
            LocationId = "terrinca",
            LocationName = "Depósito Terrinca",
            LocationType = "warehouse",
            Quantity = 5,
            ReservedQuantity = 0
        };

        _stockRepoMock.Setup(r => r.GetByIdAsync("stk-01", default)).ReturnsAsync(originStock);
        _stockRepoMock.Setup(r => r.ReserveStockAtomicAsync("stk-01", 2, default)).ReturnsAsync(true);
        _transferRepoMock.Setup(r => r.AddAsync(It.IsAny<StockTransfer>(), default))
            .ReturnsAsync((StockTransfer t, CancellationToken _) =>
            {
                t.Id = "trf-01";
                return t;
            });

        var dto = new CreateStockTransferDto(
            "stk-01",
            "guatire",
            "Tienda Guatire",
            "store",
            2,
            "Aarón",
            "Reponer exhibición"
        );

        var result = await _service.CreateTransferAsync(dto);

        Assert.NotNull(result);
        Assert.Equal("in_transit", result.Status);
        Assert.Equal(2, result.Quantity);
        Assert.Equal("terrinca", result.OriginLocationId);
        Assert.Equal("guatire", result.DestinationLocationId);
        _stockRepoMock.Verify(r => r.ReserveStockAtomicAsync("stk-01", 2, default), Times.Once);
    }

    [Fact]
    public async Task CreateTransfer_WhenDestinationIsSameAsOrigin_ThrowsInvalidOperationException()
    {
        var originStock = new PhysicalStock
        {
            Id = "stk-01",
            LocationId = "guatire",
            Quantity = 5
        };

        _stockRepoMock.Setup(r => r.GetByIdAsync("stk-01", default)).ReturnsAsync(originStock);

        var dto = new CreateStockTransferDto(
            "stk-01",
            "guatire",
            "Tienda Guatire",
            "store",
            1,
            "Aarón"
        );

        await Assert.ThrowsAsync<InvalidOperationException>(() => _service.CreateTransferAsync(dto));
    }

    [Fact]
    public async Task ConfirmTransfer_WhenInTransit_DeductsOriginAndIncrementsDestination()
    {
        var transfer = new StockTransfer
        {
            Id = "trf-01",
            TransferNumber = "TRF-260924-1234",
            StockId = "stk-01",
            ProductId = "prod-01",
            ProductName = "Cama Turín",
            VariantKey = "Matrimonial-Gris",
            OriginLocationId = "terrinca",
            DestinationLocationId = "guatire",
            DestinationLocationName = "Tienda Guatire",
            DestinationLocationType = "store",
            Quantity = 2,
            Status = "in_transit"
        };

        var existingDestStock = new PhysicalStock
        {
            Id = "stk-dest-01",
            ProductId = "prod-01",
            VariantKey = "Matrimonial-Gris",
            LocationId = "guatire",
            Quantity = 1,
            ReservedQuantity = 0
        };

        _transferRepoMock.Setup(r => r.GetByIdAsync("trf-01", default)).ReturnsAsync(transfer);
        _stockRepoMock.Setup(r => r.DeductSoldStockAtomicAsync("stk-01", 2, default)).ReturnsAsync(true);
        _stockRepoMock.Setup(r => r.FindAsync(It.IsAny<Expression<Func<PhysicalStock, bool>>>(), default))
            .ReturnsAsync(new List<PhysicalStock> { existingDestStock });
        _stockRepoMock.Setup(r => r.UpdateAsync(It.IsAny<PhysicalStock>(), default)).ReturnsAsync(true);
        _transferRepoMock.Setup(r => r.UpdateAsync(It.IsAny<StockTransfer>(), default)).ReturnsAsync(true);

        var result = await _service.ConfirmTransferAsync("trf-01", "Operador Almacén");

        Assert.NotNull(result);
        Assert.Equal("transferred", result.Status);
        Assert.Equal("Operador Almacén", result.TransferredBy);
        Assert.Equal(3, existingDestStock.Quantity); // 1 + 2 = 3
        _stockRepoMock.Verify(r => r.DeductSoldStockAtomicAsync("stk-01", 2, default), Times.Once);
    }

    [Fact]
    public async Task CancelTransfer_WhenInTransit_ReleasesStockInOrigin()
    {
        var transfer = new StockTransfer
        {
            Id = "trf-01",
            StockId = "stk-01",
            Quantity = 2,
            Status = "in_transit"
        };

        _transferRepoMock.Setup(r => r.GetByIdAsync("trf-01", default)).ReturnsAsync(transfer);
        _stockRepoMock.Setup(r => r.ReleaseStockAtomicAsync("stk-01", 2, default)).ReturnsAsync(true);
        _transferRepoMock.Setup(r => r.UpdateAsync(It.IsAny<StockTransfer>(), default)).ReturnsAsync(true);

        var ok = await _service.CancelTransferAsync("trf-01");

        Assert.True(ok);
        Assert.Equal("cancelled", transfer.Status);
        _stockRepoMock.Verify(r => r.ReleaseStockAtomicAsync("stk-01", 2, default), Times.Once);
    }
}
