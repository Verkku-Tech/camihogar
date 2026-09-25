using Moq;
using Ordina.Application.Common;
using Ordina.Application.Dashboard;
using Ordina.Domain.Catalog;
using Ordina.Domain.Finance;
using Ordina.Domain.Orders;
using Xunit;

namespace Ordina.Application.Tests;

public class WeeklyAndDailyForecastTests
{
    private readonly Mock<IDashboardRepository> _repoMock = new();
    private readonly Mock<ISalesForecastRepository> _forecastRepoMock = new();
    private readonly Mock<ITimeSeriesForecastingService> _forecasterMock = new();

    private DashboardService CreateService()
    {
        _repoMock.Setup(r => r.GetExchangeRatesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ExchangeRate> { new() { FromCurrency = "USD", ToCurrency = "VES", Rate = 40m, IsActive = true } });

        _repoMock.Setup(r => r.GetCategoriesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Category>());

        return new DashboardService(_repoMock.Object, _forecasterMock.Object, _forecastRepoMock.Object);
    }

    [Fact]
    public async Task GetSalesForecastAsync_DailyPeriod_ShouldReturn24HourlyPoints()
    {
        var orders = new List<Order>();
        _repoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = CreateService();
        var result = await service.GetSalesForecastAsync("day", 0);

        Assert.NotNull(result);
        Assert.Equal(24, result.Points.Count);
        Assert.Equal("00:00", result.Points[0].Date);
        Assert.Equal("23:00", result.Points[23].Date);
    }

    [Fact]
    public async Task GetSalesForecastAsync_WeeklyPeriod_Offset0_ShouldReturn7Days()
    {
        var orders = new List<Order>();
        _repoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        _forecasterMock.Setup(f => f.Forecast(It.IsAny<IReadOnlyList<TimeSeriesPoint>>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<double>()))
            .Returns(new ForecastResult(new List<decimal> { 100m, 120m, 110m, 130m, 150m, 200m, 180m }, 0.3, 0.05, 0.2, 5.0));

        var service = CreateService();
        var result = await service.GetSalesForecastAsync("week", 0);

        Assert.NotNull(result);
        Assert.Equal(7, result.Points.Count);
    }

    [Fact]
    public async Task GetSalesForecastAsync_WeeklyPeriod_Offset1_ShouldProjectFutureWeek()
    {
        var orders = new List<Order>();
        _repoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        _forecasterMock.Setup(f => f.Forecast(It.IsAny<IReadOnlyList<TimeSeriesPoint>>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<double>()))
            .Returns(new ForecastResult(new List<decimal> { 100m, 120m, 110m, 130m, 150m, 200m, 180m, 105m, 125m, 115m, 135m, 155m, 205m, 185m }, 0.3, 0.05, 0.2, 5.0));

        var service = CreateService();
        var result = await service.GetSalesForecastAsync("week", 1);

        Assert.NotNull(result);
        Assert.Equal(7, result.Points.Count);
        // All 7 points of a future week must have InvoicedUsd == null (pure forecast)
        Assert.All(result.Points, p => Assert.Null(p.InvoicedUsd));
    }
}
