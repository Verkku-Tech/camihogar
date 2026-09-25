using Microsoft.AspNetCore.Mvc;
using Moq;
using Ordina.Api.Controllers;
using Ordina.Application.Dashboard;
using Xunit;

namespace Ordina.Api.Tests;

public class DashboardForecastControllerTests
{
    private readonly Mock<IDashboardService> _dashboardServiceMock = new();

    [Fact]
    public async Task GetForecast_WithWeekOffset_ReturnsOkResult()
    {
        var expectedResponse = new SalesForecastResponseDto(
            new List<ForecastDataPointDto>(),
            new ForecastSummaryDto(1000m, 500m, null, 5.0)
        );

        _dashboardServiceMock
            .Setup(s => s.GetSalesForecastAsync("week", 1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedResponse);

        var controller = new DashboardController(_dashboardServiceMock.Object);
        var actionResult = await controller.GetForecast("week", 1, CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var model = Assert.IsType<SalesForecastResponseDto>(okResult.Value);
        Assert.Equal(1000m, model.Summary.ProjectedInvoicedTotal);
    }

    [Fact]
    public async Task GetForecastHistory_ReturnsOkResultWithList()
    {
        var expectedList = new List<SalesForecastHistoryItemDto>
        {
            new("id-1", 1, "Proyección 1 - Sem 22/09 al 28/09", "week", 0, DateTime.UtcNow, DateTime.UtcNow, DateTime.UtcNow, 1000m, 500m, 800m, 400m, 4.5)
        };

        _dashboardServiceMock
            .Setup(s => s.GetForecastHistoryAsync("week", It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedList);

        var controller = new DashboardController(_dashboardServiceMock.Object);
        var actionResult = await controller.GetForecastHistory("week", CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var model = Assert.IsAssignableFrom<IReadOnlyList<SalesForecastHistoryItemDto>>(okResult.Value);
        Assert.Single(model);
        Assert.Equal(1, model[0].VersionNumber);
    }

    [Fact]
    public async Task GetForecastById_WhenFound_ReturnsOkResult()
    {
        var expected = new SalesForecastRecordDto(
            "id-1",
            1,
            "Proyección 1 - Sem 22/09 al 28/09",
            "week",
            0,
            DateTime.UtcNow,
            DateTime.UtcNow,
            DateTime.UtcNow,
            new List<ForecastDataPointDto>(),
            new ForecastSummaryDto(1000m, 500m, null, 4.5)
        );

        _dashboardServiceMock
            .Setup(s => s.GetForecastByIdAsync("id-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var controller = new DashboardController(_dashboardServiceMock.Object);
        var actionResult = await controller.GetForecastById("id-1", CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var model = Assert.IsType<SalesForecastRecordDto>(okResult.Value);
        Assert.Equal("id-1", model.Id);
    }

    [Fact]
    public async Task GetForecastById_WhenNotFound_ReturnsNotFound()
    {
        _dashboardServiceMock
            .Setup(s => s.GetForecastByIdAsync("nonexistent", It.IsAny<CancellationToken>()))
            .ReturnsAsync((SalesForecastRecordDto?)null);

        var controller = new DashboardController(_dashboardServiceMock.Object);
        var actionResult = await controller.GetForecastById("nonexistent", CancellationToken.None);

        Assert.IsType<NotFoundResult>(actionResult.Result);
    }
}
