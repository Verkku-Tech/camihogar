using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using Moq;
using Ordina.Application.Common;
using Ordina.Application.Reports;
using Ordina.Domain.Orders;
using Ordina.Domain.Stores;
using Xunit;

namespace Ordina.Application.Tests;

public class PaymentsReportServiceTests
{
    private readonly Mock<IOrderRepository> _orderRepositoryMock = new();
    private readonly Mock<IClientRepository> _clientRepositoryMock = new();
    private readonly Mock<IProductRepository> _productRepositoryMock = new();
    private readonly Mock<IExchangeRateRepository> _exchangeRateRepositoryMock = new();
    private readonly Mock<IRepository<Account>> _accountRepositoryMock = new();

    private ReportService CreateService() => new(
        _orderRepositoryMock.Object,
        _clientRepositoryMock.Object,
        _productRepositoryMock.Object,
        _exchangeRateRepositoryMock.Object,
        null,
        _accountRepositoryMock.Object);

    [Fact]
    public async Task GetPaymentsReportDataAsync_FiltersOutReservationsAndDeclinedOrders()
    {
        // Arrange
        var testOrders = new List<Order>
        {
            new()
            {
                Id = "ord-1",
                OrderNumber = "ORD-001",
                ClientName = "Cliente Normal",
                TypeString = "Order",
                StatusString = "Validado",
                PaymentMethod = "Zelle",
                PaymentDetails = new PaymentDetails
                {
                    OriginalAmount = 100m,
                    OriginalCurrency = "USD",
                    Envia = "Juan Perez"
                },
                CreatedAt = new DateTime(2026, 9, 25, 12, 0, 0, DateTimeKind.Utc)
            },
            new()
            {
                Id = "res-1",
                OrderNumber = "RES-001",
                ClientName = "Cliente Reserva",
                TypeString = "Reservation",
                StatusString = "Reserva",
                PaymentMethod = "Zelle",
                PaymentDetails = new PaymentDetails { OriginalAmount = 50m, OriginalCurrency = "USD" },
                CreatedAt = new DateTime(2026, 9, 25, 12, 0, 0, DateTimeKind.Utc)
            },
            new()
            {
                Id = "ord-dec",
                OrderNumber = "ORD-DEC",
                ClientName = "Cliente Declinado",
                TypeString = "Order",
                StatusString = "Declinado",
                PaymentMethod = "Zelle",
                PaymentDetails = new PaymentDetails { OriginalAmount = 80m, OriginalCurrency = "USD" },
                CreatedAt = new DateTime(2026, 9, 25, 12, 0, 0, DateTimeKind.Utc)
            }
        };

        _orderRepositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<Order, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(testOrders);

        _accountRepositoryMock
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Account>());

        var service = CreateService();

        // Act
        var result = await service.GetPaymentsReportDataAsync();

        // Assert
        Assert.Single(result);
        Assert.Equal("ORD-001", result[0].Pedido);
        Assert.Equal("Juan Perez", result[0].Referencia);
        Assert.Equal(100m, result[0].MontoOriginal);
        Assert.Equal("USD", result[0].MonedaOriginal);
        Assert.Equal(100m, result[0].MontoUsd);
    }
}
