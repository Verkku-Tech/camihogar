using Moq;
using Ordina.Application.Common;
using Ordina.Application.Inventory;
using Ordina.Domain.Inventory;
using Xunit;

namespace Ordina.Application.Tests;

public class StockReservationServiceTests
{
    private readonly Mock<IPhysicalStockRepository> _stockRepoMock = new();
    private readonly Mock<IRepository<StockReservation>> _resRepoMock = new();
    private readonly StockReservationService _service;

    public StockReservationServiceTests()
    {
        _service = new StockReservationService(_stockRepoMock.Object, _resRepoMock.Object);
    }

    [Fact]
    public async Task ReserveItem_WhenAvailable_LocksStockAndReturnsReservation()
    {
        var stock = new PhysicalStock
        {
            Id = "66f000000000000000000010",
            ProductId = "66f000000000000000000001",
            ProductName = "Cama Turín",
            Quantity = 2,
            ReservedQuantity = 0,
            LocationId = "66f000000000000000000002",
            LocationName = "Guatire"
        };
        _stockRepoMock.Setup(r => r.GetByIdAsync("66f000000000000000000010", default)).ReturnsAsync(stock);
        _stockRepoMock.Setup(r => r.ReserveStockAtomicAsync("66f000000000000000000010", 1, default)).ReturnsAsync(true);
        _resRepoMock.Setup(r => r.AddAsync(It.IsAny<StockReservation>(), default))
            .ReturnsAsync((StockReservation r, CancellationToken _) =>
            {
                r.Id = "66f000000000000000000020";
                return r;
            });

        var dto = new CreateStockReservationDto("66f000000000000000000010", "user-1", "Vendedor Juan", 1, "counter");
        var res = await _service.ReserveItemAsync(dto);

        Assert.NotNull(res);
        Assert.Equal("active", res.Status);
        Assert.Equal("Cama Turín", res.ProductName);
        Assert.Equal("Vendedor Juan", res.VendorName);
        Assert.True(res.RemainingSeconds > 500); // 10 minutes ~ 600s
    }

    [Fact]
    public async Task ReserveItem_WhenConcurrentLockFails_ThrowsInvalidOperationException()
    {
        var stock = new PhysicalStock
        {
            Id = "66f000000000000000000010",
            ProductName = "Cama Turín",
            Quantity = 1,
            ReservedQuantity = 1
        };
        _stockRepoMock.Setup(r => r.GetByIdAsync("66f000000000000000000010", default)).ReturnsAsync(stock);
        _stockRepoMock.Setup(r => r.ReserveStockAtomicAsync("66f000000000000000000010", 1, default)).ReturnsAsync(false);

        var dto = new CreateStockReservationDto("66f000000000000000000010", "user-2", "Vendedor Pedro", 1, "counter");

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => _service.ReserveItemAsync(dto));
        Assert.Contains("disponibilidad suficiente", ex.Message);
    }

    [Fact]
    public async Task ReleaseReservation_ActiveReservation_ReleasesStockAndMarksReleased()
    {
        var reservation = new StockReservation
        {
            Id = "66f000000000000000000020",
            StockId = "66f000000000000000000010",
            Quantity = 1,
            Status = "active",
            ExpiresAt = DateTime.UtcNow.AddMinutes(5)
        };
        _resRepoMock.Setup(r => r.GetByIdAsync("66f000000000000000000020", default)).ReturnsAsync(reservation);
        _stockRepoMock.Setup(r => r.ReleaseStockAtomicAsync("66f000000000000000000010", 1, default)).ReturnsAsync(true);
        _resRepoMock.Setup(r => r.UpdateAsync(It.IsAny<StockReservation>(), default)).ReturnsAsync(true);

        var success = await _service.ReleaseReservationAsync("66f000000000000000000020");

        Assert.True(success);
        Assert.Equal("released", reservation.Status);
        _stockRepoMock.Verify(r => r.ReleaseStockAtomicAsync("66f000000000000000000010", 1, default), Times.Once);
    }

    [Fact]
    public async Task ExtendReservation_ActiveReservation_SetsFormalAndExtendsTime()
    {
        var reservation = new StockReservation
        {
            Id = "66f000000000000000000020",
            StockId = "66f000000000000000000010",
            Quantity = 1,
            ReservationType = "counter",
            Status = "active",
            ExpiresAt = DateTime.UtcNow.AddMinutes(2)
        };
        _resRepoMock.Setup(r => r.GetByIdAsync("66f000000000000000000020", default)).ReturnsAsync(reservation);
        _resRepoMock.Setup(r => r.UpdateAsync(It.IsAny<StockReservation>(), default)).ReturnsAsync(true);

        var updated = await _service.ExtendReservationAsync("66f000000000000000000020", "PED-9999");

        Assert.NotNull(updated);
        Assert.Equal("PED-9999", updated.OrderNumber);
        Assert.Equal("formal", updated.ReservationType);
        Assert.True(updated.RemainingSeconds > 1500); // 30 minutes ~ 1800s
    }

    [Fact]
    public async Task ConfirmReservation_ActiveReservation_DeductsPhysicalStockAndMarksConfirmed()
    {
        var reservation = new StockReservation
        {
            Id = "66f000000000000000000020",
            StockId = "66f000000000000000000010",
            Quantity = 1,
            Status = "active",
            ExpiresAt = DateTime.UtcNow.AddMinutes(10)
        };
        _resRepoMock.Setup(r => r.GetByIdAsync("66f000000000000000000020", default)).ReturnsAsync(reservation);
        _stockRepoMock.Setup(r => r.DeductSoldStockAtomicAsync("66f000000000000000000010", 1, default)).ReturnsAsync(true);
        _resRepoMock.Setup(r => r.UpdateAsync(It.IsAny<StockReservation>(), default)).ReturnsAsync(true);

        var success = await _service.ConfirmReservationAsync("66f000000000000000000020", "ORD-1234");

        Assert.True(success);
        Assert.Equal("confirmed", reservation.Status);
        Assert.Equal("ORD-1234", reservation.OrderNumber);
        _stockRepoMock.Verify(r => r.DeductSoldStockAtomicAsync("66f000000000000000000010", 1, default), Times.Once);
    }
}
