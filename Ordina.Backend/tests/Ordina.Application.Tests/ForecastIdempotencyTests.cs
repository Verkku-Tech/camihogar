using Moq;
using Ordina.Application.Common;
using Ordina.Application.Dashboard;
using Ordina.Domain.Catalog;
using Ordina.Domain.Dashboard;
using Ordina.Domain.Finance;
using Ordina.Domain.Orders;
using Xunit;

namespace Ordina.Application.Tests;

public class ForecastIdempotencyTests
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

        _repoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Order>());

        _forecasterMock.Setup(f => f.Forecast(It.IsAny<IReadOnlyList<TimeSeriesPoint>>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<double>()))
            .Returns(new ForecastResult(Enumerable.Repeat(100m, 31).ToList(), 0.3, 0.05, 0.2, 5.0));

        return new DashboardService(_repoMock.Object, _forecasterMock.Object, _forecastRepoMock.Object);
    }

    [Fact]
    public async Task GetSalesForecastAsync_WhenNoExistingRecord_ShouldInsertNewVersion()
    {
        _forecastRepoMock.Setup(r => r.GetLatestAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((SalesForecastRecord?)null);

        _forecastRepoMock.Setup(r => r.GetMaxVersionNumberAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        var service = CreateService();
        await service.GetSalesForecastAsync("month", 0);

        _forecastRepoMock.Verify(r => r.InsertAsync(It.Is<SalesForecastRecord>(rec => rec.VersionNumber == 1), It.IsAny<CancellationToken>()), Times.Once);
        _forecastRepoMock.Verify(r => r.UpdateAsync(It.IsAny<SalesForecastRecord>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetSalesForecastAsync_WhenExistingRecordHasSameHash_ShouldUpdateInsteadOfInsert()
    {
        var service = CreateService();
        int days = DateTime.DaysInMonth(DateTime.UtcNow.Year, DateTime.UtcNow.Month);
        var expectedPoints = Enumerable.Range(1, days)
            .Select(i => new ForecastDataPointDto($"day-{i}", $"day-{i}", null, null, 100m, 45m, null))
            .ToList();
        var matchingHash = service.ComputeProjectionsHash(expectedPoints);

        var existing = new SalesForecastRecord
        {
            Id = "60c72b2f9b1d8b2badbee999",
            VersionNumber = 1,
            Period = "month",
            WeekOffset = 0,
            ProjectionsHash = matchingHash
        };

        _forecastRepoMock.Setup(r => r.GetLatestAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        await service.GetSalesForecastAsync("month", 0);

        _forecastRepoMock.Verify(r => r.UpdateAsync(It.Is<SalesForecastRecord>(rec => rec.Id == existing.Id), It.IsAny<CancellationToken>()), Times.Once);
        _forecastRepoMock.Verify(r => r.InsertAsync(It.IsAny<SalesForecastRecord>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
