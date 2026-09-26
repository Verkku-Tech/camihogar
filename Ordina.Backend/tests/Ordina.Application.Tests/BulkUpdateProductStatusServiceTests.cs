using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Moq;
using Ordina.Application.Common;
using Ordina.Application.Notifications;
using Ordina.Application.Orders;
using Ordina.Domain.Orders;
using Xunit;

namespace Ordina.Application.Tests;

public class BulkUpdateProductStatusServiceTests
{
    private readonly Mock<IOrderRepository> _orderRepoMock = new();
    private readonly Mock<ILogger<OrderCoreService>> _loggerMock = new();
    private readonly Mock<INotificationService> _notificationServiceMock = new();
    private readonly Mock<IOrderAuditLogService> _auditLogServiceMock = new();

    private OrderCoreService CreateService() => new(
        _orderRepoMock.Object,
        _loggerMock.Object,
        _notificationServiceMock.Object,
        _auditLogServiceMock.Object);

    [Fact]
    public async Task BulkUpdateProductStatusAsync_QueueAction_UpdatesToReporteDeFabricacion()
    {
        // Arrange
        const string orderId = "6ab675186c3368f22479cab4";
        const string productId = "6ab543db3e602a621e86182b";

        var order = new Order
        {
            Id = orderId,
            OrderNumber = "ORD-2178",
            ClientName = "Test Client",
            TypeString = "Order",
            StatusString = "Validado",
            Products = new List<OrderProduct>
            {
                new()
                {
                    Id = productId,
                    Name = "Mueble Prueba",
                    LocationStatusString = "FABRICACION",
                    ManufacturingStatusString = "debe_fabricar",
                    LogisticStatusString = "Validado"
                }
            }
        };

        _orderRepoMock
            .Setup(r => r.GetByIdAsync(orderId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);

        _orderRepoMock
            .Setup(r => r.UpdateAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var service = CreateService();

        var request = new BulkUpdateProductStatusRequestDto(
            Items: new List<BulkUpdateProductStatusItemDto>
            {
                new(orderId, productId)
            },
            Action: "queue",
            ProviderId: "prov-1",
            ProviderName: "Carpintería Pérez",
            Notes: "Prioridad alta");

        // Act
        var result = await service.BulkUpdateProductStatusAsync(
            request, "user-1", "Admin", null, CancellationToken.None);

        // Assert
        Assert.Equal(1, result.SuccessCount);
        Assert.Equal(0, result.ErrorCount);
        Assert.Empty(result.Errors);

        var updatedProduct = order.Products[0];
        Assert.Equal("por_fabricar", updatedProduct.ManufacturingStatusString);
        Assert.Equal("prov-1", updatedProduct.ManufacturingProviderId);
        Assert.Equal("Carpintería Pérez", updatedProduct.ManufacturingProviderName);
        Assert.Equal("Prioridad alta", updatedProduct.ManufacturingNotes);
        Assert.Equal("Reporte de fabricación", order.StatusString);

        _orderRepoMock.Verify(r => r.UpdateAsync(order, It.IsAny<CancellationToken>()), Times.Once);
        _auditLogServiceMock.Verify(a => a.LogOrderUpdatedAsync(
            It.IsAny<Order>(), order, "user-1", "Admin", It.IsAny<CancellationToken>()), Times.Once);
    }
}
