using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Moq;
using Ordina.Application.Common;
using Ordina.Application.Dashboard;
using Ordina.Application.Finance;
using Ordina.Domain.Finance;
using Ordina.Domain.Orders;
using Xunit;

namespace Ordina.Application.Tests;

public class DashboardAndFinanceTests
{
    [Fact]
    public async Task DashboardService_Calculates_MultiCurrency_And_Cashea_Correctly()
    {
        // Arrange
        var dashboardRepoMock = new Mock<IDashboardRepository>();

        var rates = new List<ExchangeRate>
        {
            new() { FromCurrency = "Bs", ToCurrency = "USD", Rate = 800m, IsActive = true, EffectiveDate = DateTime.UtcNow },
            new() { FromCurrency = "Bs", ToCurrency = "EUR", Rate = 960m, IsActive = true, EffectiveDate = DateTime.UtcNow }
        };
        dashboardRepoMock.Setup(r => r.GetExchangeRatesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(rates);

        var now = DateTime.UtcNow;
        var orders = new List<Order>
        {
            // Orden 1: Base USD $100 con pago en USD ($50) y pago en Bs (24,000 Bs / 800 = $30)
            new()
            {
                Id = "ord-1",
                OrderNumber = "ORD-001",
                TypeString = "Order",
                StatusString = "Entregado",
                BaseCurrency = "USD",
                Total = 100m,
                CreatedAt = now,
                PartialPayments = new List<PartialPayment>
                {
                    new()
                    {
                        Amount = 50m,
                        Date = now,
                        PaymentDetails = new PaymentDetails { OriginalCurrency = "USD", OriginalAmount = 50m }
                    },
                    new()
                    {
                        Amount = 24000m,
                        Date = now,
                        PaymentDetails = new PaymentDetails { OriginalCurrency = "Bs", OriginalAmount = 24000m, ExchangeRate = 800m }
                    }
                }
            },
            // Orden 2: Base Bs 80,000 Bs (equivale a $100) con pago en EUR (50 EUR * 960 / 800 = $60) y stub de Cashea ($40 financiado)
            new()
            {
                Id = "ord-2",
                OrderNumber = "ORD-002",
                TypeString = "Order",
                StatusString = "Pendiente",
                BaseCurrency = "Bs",
                Total = 80000m,
                CreatedAt = now,
                ExchangeRatesAtCreation = new ExchangeRatesAtCreation
                {
                    Usd = new ExchangeRateInfo { Rate = 800m },
                    Eur = new ExchangeRateInfo { Rate = 960m }
                },
                PartialPayments = new List<PartialPayment>
                {
                    new()
                    {
                        Amount = 50m,
                        Date = now,
                        PaymentDetails = new PaymentDetails { OriginalCurrency = "EUR", OriginalAmount = 50m }
                    },
                    new()
                    {
                        Amount = 40m,
                        Date = now,
                        Method = "Cashea (financiación)",
                        PaymentDetails = new PaymentDetails { CasheaFinancedPortion = true, OriginalAmount = 40m, OriginalCurrency = "USD" }
                    }
                }
            }
        };

        dashboardRepoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(dashboardRepoMock.Object);

        // Act
        var metrics = await service.GetDashboardMetricsAsync("day", cancellationToken: CancellationToken.None);

        // Assert
        // Total Invoiced: Ord1 ($100) + Ord2 (80,000 Bs / 800 = $100) = $200 USD
        Assert.Equal(200m, metrics.TotalInvoiced);

        // Total Collected (excluyendo Cashea):
        // Ord1: $50 USD + (24,000 Bs / 800 = $30 USD) = $80 USD
        // Ord2: 50 EUR * 960 / 800 = $60 USD
        // Total Collected = $80 + $60 = $140 USD
        Assert.Equal(140m, metrics.TotalCollected);

        // Cashea financiado: $40 USD
        Assert.Equal(40m, metrics.CasheaFinancedAmount);
    }

    [Fact]
    public async Task ExchangeRateService_SetRateAsync_DeactivatesPreviousRates()
    {
        // Arrange
        var rateRepoMock = new Mock<IExchangeRateRepository>();
        var cacheMock = new Mock<ICacheService>();
        var loggerMock = new Mock<ILogger<ExchangeRateService>>();

        rateRepoMock.Setup(r => r.AddAsync(It.IsAny<ExchangeRate>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((ExchangeRate r, CancellationToken _) => r);

        var service = new ExchangeRateService(rateRepoMock.Object, cacheMock.Object, loggerMock.Object);

        var dto = new SetExchangeRateDto("Bs", "USD", 850m, DateTime.UtcNow);

        // Act
        var result = await service.SetRateAsync(dto, CancellationToken.None);

        // Assert
        rateRepoMock.Verify(r => r.DeactivatePreviousRatesAsync("Bs", "USD", It.IsAny<CancellationToken>()), Times.Once);
        Assert.Equal(850m, result.Rate);
        Assert.True(result.IsActive);
    }
}
