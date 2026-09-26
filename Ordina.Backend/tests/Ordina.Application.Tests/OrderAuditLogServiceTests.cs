using Microsoft.Extensions.Logging;
using Moq;
using Ordina.Application.Common;
using Ordina.Application.Orders;
using Ordina.Domain.Orders;
using Xunit;

namespace Ordina.Application.Tests;

public class OrderAuditLogServiceTests
{
    private class TestTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }

    private readonly Mock<IOrderAuditLogRepository> _repoMock = new();
    private readonly Mock<ILogger<OrderAuditLogService>> _loggerMock = new();
    private readonly TestTimeProvider _timeProvider = new(new DateTimeOffset(2026, 9, 23, 15, 0, 0, TimeSpan.Zero));
    private readonly OrderAuditLogService _service;

    public OrderAuditLogServiceTests()
    {
        _service = new OrderAuditLogService(_repoMock.Object, _loggerMock.Object, _timeProvider);
    }

    [Fact]
    public async Task GetPagedLogsAsync_NormalizesOrderNumberAndMapsDto()
    {
        // Arrange
        var fakeLogs = new List<OrderAuditLog>
        {
            new()
            {
                Id = "66f1a2b3c4d5e6f7a8b9c0d1",
                OrderId = "66f1a2b3c4d5e6f7a8b9c0d2",
                OrderNumber = "ORD-001",
                Action = "created",
                UserId = "user-1",
                UserName = "Admin",
                Summary = "Creó el pedido ORD-001",
                Changes = [],
                Timestamp = _timeProvider.GetUtcNow().UtcDateTime
            }
        };

        _repoMock.Setup(r => r.GetPagedLogsAsync(
            1, 10, null, "ORD-001", null, null, null, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PagedResult<OrderAuditLog>(fakeLogs, 1, 1, 10));

        // Act
        var result = await _service.GetPagedLogsAsync(
            1, 10, null, "1", null, null, null, false, CancellationToken.None);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(1, result.TotalCount);
        Assert.Equal(1, result.TotalPages);
        Assert.Single(result.Items);
        var item = result.Items.First();
        Assert.Equal("ORD-001", item.OrderNumber);
        Assert.Equal("created", item.Action);
    }

    [Fact]
    public async Task LogOrderCreatedAsync_AddsAuditLogWithCorrectTimestamp()
    {
        // Arrange
        var order = new Order
        {
            Id = "66f1a2b3c4d5e6f7a8b9c0d2",
            OrderNumber = "ORD-005",
            ClientName = "Cliente Prueba",
            VendorId = "v-1",
            VendorName = "Vendedor"
        };

        OrderAuditLog? savedLog = null;
        _repoMock.Setup(r => r.AddAsync(It.IsAny<OrderAuditLog>(), It.IsAny<CancellationToken>()))
            .Callback<OrderAuditLog, CancellationToken>((l, _) => savedLog = l)
            .ReturnsAsync((OrderAuditLog l, CancellationToken _) => l);

        // Act
        await _service.LogOrderCreatedAsync(order, "user-42", "Juan Perez", CancellationToken.None);

        // Assert
        Assert.NotNull(savedLog);
        Assert.Equal("ORD-005", savedLog.OrderNumber);
        Assert.Equal("created", savedLog.Action);
        Assert.Equal("user-42", savedLog.UserId);
        Assert.Equal("Juan Perez", savedLog.UserName);
        Assert.Equal(_timeProvider.GetUtcNow().UtcDateTime, savedLog.Timestamp);
    }

    [Fact]
    public async Task LogOrderUpdatedAsync_GeneratesDiffWhenStatusChanges()
    {
        // Arrange
        var oldOrder = new Order
        {
            Id = "66f1a2b3c4d5e6f7a8b9c0d2",
            OrderNumber = "ORD-005",
            StatusString = "Pendiente"
        };
        var newOrder = new Order
        {
            Id = "66f1a2b3c4d5e6f7a8b9c0d2",
            OrderNumber = "ORD-005",
            StatusString = "Completado"
        };

        OrderAuditLog? savedLog = null;
        _repoMock.Setup(r => r.AddAsync(It.IsAny<OrderAuditLog>(), It.IsAny<CancellationToken>()))
            .Callback<OrderAuditLog, CancellationToken>((l, _) => savedLog = l)
            .ReturnsAsync((OrderAuditLog l, CancellationToken _) => l);

        // Act
        await _service.LogOrderUpdatedAsync(oldOrder, newOrder, "u-1", "Admin", CancellationToken.None);

        // Assert
        Assert.NotNull(savedLog);
        Assert.Single(savedLog.Changes);
        Assert.Equal("Status", savedLog.Changes[0].Field);
        Assert.Equal("Pendiente", savedLog.Changes[0].OldValue);
        Assert.Equal("Completado", savedLog.Changes[0].NewValue);
    }

    [Fact]
    public async Task GetPagedLogsAsync_WithPaymentChange_FormatsWithoutCultureException()
    {
        // Arrange
        var fakeLogs = new List<OrderAuditLog>
        {
            new()
            {
                Id = "66f1a2b3c4d5e6f7a8b9c0d1",
                OrderId = "66f1a2b3c4d5e6f7a8b9c0d2",
                OrderNumber = "ORD-001",
                Action = "updated",
                UserId = "user-1",
                UserName = "Admin",
                Summary = "Actualizó el pedido ORD-001",
                Changes =
                [
                    new AuditChange
                    {
                        Field = "partialPayments[+]",
                        OldValue = null,
                        NewValue = "Método=Pago móvil; Monto=1500.50; Moneda=Bs; Fecha=2026-09-23T15:00:00Z"
                    }
                ],
                Timestamp = _timeProvider.GetUtcNow().UtcDateTime
            }
        };

        _repoMock.Setup(r => r.GetPagedLogsAsync(
            1, 10, null, null, null, null, null, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PagedResult<OrderAuditLog>(fakeLogs, 1, 1, 10));

        // Act
        var result = await _service.GetPagedLogsAsync(
            1, 10, null, null, null, null, null, false, CancellationToken.None);

        // Assert
        Assert.NotNull(result);
        var change = Assert.Single(result.Items.First().Changes);
        Assert.Equal("Pago agregado", change.DisplayField);
        Assert.Contains("1.500,50", change.DisplayNewValue);
    }
}
