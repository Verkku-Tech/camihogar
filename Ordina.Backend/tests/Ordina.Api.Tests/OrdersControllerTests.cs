using Microsoft.AspNetCore.Mvc;
using Moq;
using Ordina.Api.Controllers;
using Ordina.Application.Orders;
using Xunit;

namespace Ordina.Api.Tests;

public class OrdersControllerTests
{
    private readonly Mock<IOrderCoreService> _orderServiceMock = new();
    private readonly Mock<IOrderAuditLogService> _auditLogServiceMock = new();

    private OrdersController CreateController() => new(_orderServiceMock.Object, _auditLogServiceMock.Object);

    [Fact]
    public async Task GetAuditLogs_ReturnsOkObjectResult_WithPagedAuditLogs()
    {
        // Arrange
        var pagedResponse = new PagedAuditLogsResponseDto(
            Items: [
                new OrderAuditLogDto(
                    Id: "507f1f77bcf86cd799439011",
                    OrderId: "507f1f77bcf86cd799439012",
                    OrderNumber: "ORD-2026-0001",
                    Action: "create",
                    UserId: "user-1",
                    UserName: "Test User",
                    Summary: "Creó el pedido ORD-2026-0001",
                    Changes: [],
                    Timestamp: DateTime.UtcNow)
            ],
            Page: 1,
            PageSize: 10,
            TotalCount: 1,
            TotalPages: 1);

        _auditLogServiceMock
            .Setup(s => s.GetPagedLogsAsync(
                1, 10, null, null, null, null, null, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(pagedResponse);

        var controller = CreateController();

        // Act
        var result = await controller.GetAuditLogs(
            page: 1, pageSize: 10, cancellationToken: CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var value = Assert.IsType<PagedAuditLogsResponseDto>(okResult.Value);
        Assert.Single(value.Items);
        Assert.Equal("ORD-2026-0001", value.Items.First().OrderNumber);
    }

    [Theory]
    [InlineData("audit-logs")]
    [InlineData("invalid-id")]
    [InlineData("123")]
    [InlineData("not-a-valid-24-hex-id-!!")]
    public async Task GetById_WithNon24HexOrRouteShadowString_ReturnsNotFound_WithoutCallingRepository(string invalidId)
    {
        // Arrange
        var controller = CreateController();

        // Act
        var result = await controller.GetById(invalidId, CancellationToken.None);

        // Assert
        Assert.IsType<NotFoundResult>(result.Result);
        _orderServiceMock.Verify(s => s.GetByIdAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetById_WithValid24HexId_ReturnsOk_WhenOrderExists()
    {
        // Arrange
        const string validId = "507f1f77bcf86cd799439011";
        var orderResponse = new OrderResponseDto(
            Id: validId,
            OrderNumber: "ORD-2026-0001",
            ConvertedFromNumber: "",
            ClientId: "client-1",
            ClientName: "Cliente Prueba",
            VendorId: "vendor-1",
            VendorName: "Vendedor Prueba",
            ReferrerId: null,
            ReferrerName: null,
            PostventaId: null,
            PostventaName: null,
            Products: [],
            Subtotal: 100,
            TaxAmount: 0,
            DeliveryCost: 10,
            Total: 110,
            SubtotalBeforeDiscounts: 100,
            ProductDiscountTotal: 0,
            GeneralDiscountAmount: 0,
            GeneralDiscountType: null,
            GeneralDiscountPercent: null,
            PaymentType: "directo",
            PaymentMethod: "Efectivo",
            PaymentCondition: null,
            PaymentDetails: null,
            PartialPayments: null,
            MixedPayments: null,
            AppliedStoreCreditUsd: 0,
            DeliveryAddress: null,
            HasDelivery: false,
            DeliveryServices: null,
            Status: "Pendiente",
            Observations: null,
            DispatchObservations: null,
            DeclineReason: null,
            SaleType: "entrega",
            DeliveryType: "tienda",
            DeliveryZone: null,
            BaseCurrency: "USD",
            Type: "Order",
            CreatedAt: DateTime.UtcNow,
            UpdatedAt: DateTime.UtcNow);

        _orderServiceMock
            .Setup(s => s.GetByIdAsync(validId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(orderResponse);

        var controller = CreateController();

        // Act
        var result = await controller.GetById(validId, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var value = Assert.IsType<OrderResponseDto>(okResult.Value);
        Assert.Equal(validId, value.Id);
    }

    [Fact]
    public async Task BulkUpdateProductStatus_ReturnsOkWithResponseDto()
    {
        // Arrange
        var request = new BulkUpdateProductStatusRequestDto(
            Items: [new("order-1", "prod-1")],
            Action: "queue");

        var responseDto = new BulkUpdateProductStatusResponseDto
        {
            SuccessCount = 1,
            ErrorCount = 0
        };

        _orderServiceMock
            .Setup(s => s.BulkUpdateProductStatusAsync(
                request, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(responseDto);

        var controller = CreateController();

        // Act
        var result = await controller.BulkUpdateProductStatus(request, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var value = Assert.IsType<BulkUpdateProductStatusResponseDto>(okResult.Value);
        Assert.Equal(1, value.SuccessCount);
        Assert.Equal(0, value.ErrorCount);
    }
}
