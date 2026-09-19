using System;
using System.Collections.Generic;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Moq;
using Ordina.Application.Common;
using Ordina.Application.Orders;
using Ordina.Domain.Catalog;
using Ordina.Domain.Enums;
using Ordina.Domain.Orders;
using Xunit;

namespace Ordina.Application.Tests;

public class OrderCoreServiceTests
{
    private readonly Mock<IOrderRepository> _orderRepoMock = new();
    private readonly Mock<ILogger<OrderCoreService>> _loggerMock = new();
    private readonly OrderCoreService _service;

    public OrderCoreServiceTests()
    {
        _service = new OrderCoreService(_orderRepoMock.Object, _loggerMock.Object);
    }

    [Fact]
    public async Task UpdateOrderAsync_ThrowsConcurrencyConflict_WhenExpectedUpdatedAtDoesNotMatch()
    {
        // Arrange
        var orderId = "order-123";
        var originalUpdatedAt = new DateTime(2026, 9, 18, 12, 0, 0, DateTimeKind.Utc);
        var staleExpectedUpdatedAt = new DateTime(2026, 9, 18, 11, 0, 0, DateTimeKind.Utc);

        var existingOrder = new Order
        {
            Id = orderId,
            OrderNumber = "ORD-001",
            ClientId = "client-1",
            ClientName = "Test Client",
            VendorId = "vendor-1",
            VendorName = "Test Vendor",
            UpdatedAt = originalUpdatedAt,
            Products = new List<OrderProduct>()
        };

        _orderRepoMock.Setup(r => r.GetByIdAsync(orderId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingOrder);

        _orderRepoMock.Setup(r => r.UpdateWithConcurrencyAsync(It.IsAny<Order>(), staleExpectedUpdatedAt, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var updateDto = new UpdateOrderDto(Observations: "Updated observations");

        // Act & Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.UpdateOrderAsync(orderId, updateDto, staleExpectedUpdatedAt, CancellationToken.None));

        Assert.True(ex.Message.Contains("CONFLICT:") || ex.Message.Contains("modificado", StringComparison.OrdinalIgnoreCase));
        _orderRepoMock.Verify(r => r.UpdateWithConcurrencyAsync(It.IsAny<Order>(), staleExpectedUpdatedAt, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateOrderAsync_Succeeds_WhenExpectedUpdatedAtMatches()
    {
        // Arrange
        var orderId = "order-123";
        var currentUpdatedAt = new DateTime(2026, 9, 18, 12, 0, 0, DateTimeKind.Utc);

        var existingOrder = new Order
        {
            Id = orderId,
            OrderNumber = "ORD-001",
            ClientId = "client-1",
            ClientName = "Test Client",
            VendorId = "vendor-1",
            VendorName = "Test Vendor",
            UpdatedAt = currentUpdatedAt,
            Total = 100,
            Products = new List<OrderProduct>()
        };

        _orderRepoMock.Setup(r => r.GetByIdAsync(orderId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingOrder);

        _orderRepoMock.Setup(r => r.UpdateWithConcurrencyAsync(It.IsAny<Order>(), currentUpdatedAt, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var updateDto = new UpdateOrderDto(Observations: "Updated notes");

        // Act
        var result = await _service.UpdateOrderAsync(orderId, updateDto, currentUpdatedAt, CancellationToken.None);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Updated notes", result.Observations);
        _orderRepoMock.Verify(r => r.UpdateWithConcurrencyAsync(existingOrder, currentUpdatedAt, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateOrderAsync_CalculatesTotalsWithGeneralDiscountCorrectly()
    {
        // Arrange
        _orderRepoMock.Setup(r => r.GenerateOrderNumberAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("ORD-2026-0001");

        _orderRepoMock.Setup(r => r.AddAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Order o, CancellationToken _) => o);

        var products = new List<OrderProductDto>
        {
            new OrderProductDto(
                Id: "prod-1",
                Name: "Cama King",
                Price: 500,
                Quantity: 2,
                Total: 1000,
                Category: "Camas",
                Stock: 5)
        };

        var createDto = new CreateOrderDto(
            ClientId: "client-1",
            ClientName: "Juan Perez",
            VendorId: "vendor-1",
            VendorName: "Vendedor Uno",
            Products: products,
            DeliveryCost: 50,
            GeneralDiscountPercent: 10 // 10% discount on $1000 = $100 discount -> $900 + $50 delivery = $950
        );

        // Act
        var result = await _service.CreateOrderAsync(createDto, CancellationToken.None);

        // Assert
        Assert.Equal("ORD-2026-0001", result.OrderNumber);
        Assert.Equal(1000, result.Subtotal);
        Assert.Equal(100, result.GeneralDiscountAmount);
        Assert.Equal(50, result.DeliveryCost);
        Assert.Equal(950, result.Total);
    }
}
