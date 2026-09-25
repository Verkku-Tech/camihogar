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
    private readonly Mock<IOrderAuditLogService> _auditLogMock = new();
    private readonly OrderCoreService _service;

    public OrderCoreServiceTests()
    {
        _service = new OrderCoreService(_orderRepoMock.Object, _loggerMock.Object, auditLogService: _auditLogMock.Object);
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

    [Fact]
    public async Task ConciliatePaymentsAsync_UpdatesPaymentConciliatedFlag()
    {
        // Arrange
        var orderId = "order-conciliate-1";
        var order = new Order
        {
            Id = orderId,
            OrderNumber = "ORD-CONC-001",
            PaymentDetails = new PaymentDetails { IsConciliated = false },
            PartialPayments = new List<PartialPayment>
            {
                new() { Id = "pay-1", Amount = 50, PaymentDetails = new PaymentDetails { IsConciliated = false } },
                new() { Id = "pay-2", Amount = 50, PaymentDetails = new PaymentDetails { IsConciliated = false } }
            },
            MixedPayments = new List<PartialPayment>
            {
                new() { Id = "mix-1", Amount = 100, PaymentDetails = new PaymentDetails { IsConciliated = false } }
            }
        };

        _orderRepoMock.Setup(r => r.GetByIdAsync(orderId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);

        var requests = new List<ConciliatePaymentRequestDto>
        {
            new(orderId, "main", 0, true),
            new(orderId, "partial", 1, true),
            new(orderId, "mixed", 0, true)
        };

        // Act
        var result = await _service.ConciliatePaymentsAsync(requests, CancellationToken.None);

        // Assert
        Assert.True(result);
        Assert.True(order.PaymentDetails!.IsConciliated);
        Assert.False(order.PartialPayments[0].PaymentDetails!.IsConciliated);
        Assert.True(order.PartialPayments[1].PaymentDetails!.IsConciliated);
        Assert.True(order.MixedPayments[0].PaymentDetails!.IsConciliated);
        _orderRepoMock.Verify(r => r.UpdateAsync(order, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeclineOrderAsync_CompletedOrder_DeclinesOrderAndAllProducts()
    {
        // Arrange
        var orderId = "ord-decline-1";
        var order = new Order
        {
            Id = orderId,
            OrderNumber = "ORD-1292",
            TypeString = "Order",
            StatusString = "Completado",
            Products = new List<OrderProduct>
            {
                new() { Id = "p-1", Name = "SOFA", LogisticStatusString = "Completado", LocationStatusString = "DESPACHADO" },
                new() { Id = "p-2", Name = "MESA", LogisticStatusString = "Validado", LocationStatusString = "EN_TIENDA" }
            }
        };

        _orderRepoMock.Setup(r => r.GetByIdAsync(orderId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);
        _orderRepoMock.Setup(r => r.UpdateAsync(order, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var result = await _service.DeclineOrderAsync(orderId, "user-1", "Admin", "Solicitado por lisbeth", CancellationToken.None);

        // Assert
        Assert.Equal("Declinado", result.Status);
        Assert.Equal("Solicitado por lisbeth", result.DeclineReason);
        Assert.All(result.Products, p => Assert.Equal("Declinado", p.LogisticStatus));
        _auditLogMock.Verify(a => a.LogOrderDeclinedAsync(order, "user-1", "Admin", "Solicitado por lisbeth", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeclineOrderAsync_ThrowsArgumentException_WhenNotAnOrder()
    {
        // Arrange
        var orderId = "bud-1";
        var order = new Order
        {
            Id = orderId,
            OrderNumber = "PRE-100",
            TypeString = "Budget",
            StatusString = "Presupuesto"
        };

        _orderRepoMock.Setup(r => r.GetByIdAsync(orderId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);

        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _service.DeclineOrderAsync(orderId, "user-1", "Admin", "Razon", CancellationToken.None));
    }

    [Fact]
    public async Task ReactivateOrderAsync_ReactivatesDeclinedOrderToGenerado()
    {
        // Arrange
        var orderId = "ord-reactivate-1";
        var order = new Order
        {
            Id = orderId,
            OrderNumber = "ORD-1292",
            TypeString = "Order",
            StatusString = "Declinado",
            DeclineReason = "Solicitado por lisbeth",
            Products = new List<OrderProduct>
            {
                new() { Id = "p-1", Name = "SOFA", LogisticStatusString = "Declinado" }
            }
        };

        _orderRepoMock.Setup(r => r.GetByIdAsync(orderId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(order);
        _orderRepoMock.Setup(r => r.UpdateAsync(order, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var result = await _service.ReactivateOrderAsync(orderId, "user-1", "Admin", CancellationToken.None);

        // Assert
        Assert.Equal("Generado", result.Status);
        Assert.Null(result.DeclineReason);
        Assert.All(result.Products, p => Assert.Equal("Generado", p.LogisticStatus));
        _auditLogMock.Verify(a => a.LogOrderDeclineRevertedAsync(order, "user-1", "Admin", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public void DeclineOrderRequestDto_SupportsBothReasonAndDeclineReason()
    {
        var json1 = "{\"reason\":\"Motivo 1\"}";
        var dto1 = System.Text.Json.JsonSerializer.Deserialize<DeclineOrderRequestDto>(json1, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        Assert.NotNull(dto1);
        Assert.Equal("Motivo 1", dto1.GetReason());

        var json2 = "{\"declineReason\":\"Motivo 2\"}";
        var dto2 = System.Text.Json.JsonSerializer.Deserialize<DeclineOrderRequestDto>(json2, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        Assert.NotNull(dto2);
        Assert.Equal("Motivo 2", dto2.GetReason());
    }
}
