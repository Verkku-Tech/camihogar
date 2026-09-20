using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Moq;
using Ordina.Application.Common;
using Ordina.Application.Dashboard;
using Ordina.Domain.Finance;
using Ordina.Domain.Orders;
using Xunit;

namespace Ordina.Application.Tests;

public class DashboardForecastTests
{
    [Fact]
    public async Task GetSalesForecastAsync_MonthlyPeriod_GeneratesRealAndProjectedSeries()
    {
        // Arrange
        var dashboardRepoMock = new Mock<IDashboardRepository>();
        var forecaster = new HoltWintersForecastingService();

        var rates = new List<ExchangeRate>
        {
            new() { FromCurrency = "Bs", ToCurrency = "USD", Rate = 800m, IsActive = true, EffectiveDate = DateTime.UtcNow }
        };
        dashboardRepoMock.Setup(r => r.GetExchangeRatesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(rates);

        var now = DateTime.UtcNow;
        var orders = new List<Order>();

        // Create 60 days of historical orders
        for (int i = 0; i < 60; i++)
        {
            var date = now.AddDays(-60 + i);
            orders.Add(new Order
            {
                Id = $"ord-{i}",
                OrderNumber = $"ORD-{i:000}",
                TypeString = "Order",
                StatusString = "Entregado",
                BaseCurrency = "USD",
                Total = 200m + (i % 7) * 20m,
                CreatedAt = date,
                PartialPayments = new List<PartialPayment>
                {
                    new()
                    {
                        Amount = 120m,
                        Date = date,
                        PaymentDetails = new PaymentDetails { OriginalCurrency = "USD", OriginalAmount = 120m }
                    }
                }
            });
        }

        dashboardRepoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(dashboardRepoMock.Object, forecaster);

        // Act
        var response = await service.GetSalesForecastAsync("month", CancellationToken.None);

        // Assert
        Assert.NotNull(response);
        Assert.NotEmpty(response.Points);
        Assert.NotNull(response.Summary);
        Assert.True(response.Summary.ProjectedInvoicedTotal > 0);
        Assert.True(response.Summary.ProjectedCollectedTotal > 0);

        // Check anchor point: Today must have both real and projected values
        var todayStr = (now + TimeSpan.FromHours(-4)).ToString("yyyy-MM-dd");
        var todayPoint = response.Points.FirstOrDefault(p => p.Date == todayStr);
        if (todayPoint != null)
        {
            Assert.NotNull(todayPoint.InvoicedUsd);
            Assert.NotNull(todayPoint.ProjectedInvoiced);
        }
    }

    [Fact]
    public async Task GetSalesForecastAsync_YearlyPeriod_Returns12MonthsAndBenchmark()
    {
        // Arrange
        var dashboardRepoMock = new Mock<IDashboardRepository>();
        var forecaster = new HoltWintersForecastingService();

        var rates = new List<ExchangeRate>
        {
            new() { FromCurrency = "Bs", ToCurrency = "USD", Rate = 800m, IsActive = true, EffectiveDate = DateTime.UtcNow }
        };
        dashboardRepoMock.Setup(r => r.GetExchangeRatesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(rates);

        var now = DateTime.UtcNow;
        var orders = new List<Order>();

        // Past 3 years of orders across months
        for (int yr = 1; yr <= 3; yr++)
        {
            for (int m = 1; m <= 12; m++)
            {
                var dt = new DateTime(now.Year - yr, m, 15, 12, 0, 0, DateTimeKind.Utc);
                orders.Add(new Order
                {
                    Id = $"ord-hist-{yr}-{m}",
                    OrderNumber = $"ORD-H-{yr}-{m}",
                    TypeString = "Order",
                    StatusString = "Entregado",
                    BaseCurrency = "USD",
                    Total = 1000m + (m * 50m),
                    CreatedAt = dt,
                    PartialPayments = new List<PartialPayment>
                    {
                        new()
                        {
                            Amount = 600m,
                            Date = dt,
                            PaymentDetails = new PaymentDetails { OriginalCurrency = "USD", OriginalAmount = 600m }
                        }
                    }
                });
            }
        }

        dashboardRepoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(dashboardRepoMock.Object, forecaster);

        // Act
        var response = await service.GetSalesForecastAsync("year", CancellationToken.None);

        // Assert
        Assert.NotNull(response);
        Assert.Equal(12, response.Points.Count); // 12 months
        Assert.NotNull(response.Summary.BenchmarkTotal);
        Assert.True(response.Summary.BenchmarkTotal > 0);
        Assert.All(response.Points, p => Assert.NotNull(p.Benchmark3Yr));
    }
}
