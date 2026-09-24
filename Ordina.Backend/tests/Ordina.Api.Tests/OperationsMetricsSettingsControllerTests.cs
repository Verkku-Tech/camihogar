using Microsoft.AspNetCore.Mvc;
using Moq;
using Ordina.Api.Controllers;
using Ordina.Application.Analytics;
using Ordina.Domain.Analytics;
using Xunit;

namespace Ordina.Api.Tests;

public class OperationsMetricsSettingsControllerTests
{
    [Fact]
    public async Task Get_ReturnsOkResultWithSettings()
    {
        var mockService = new Mock<IOperationsMetricsSettingsService>();
        mockService.Setup(s => s.GetSettingsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OperationsMetricsSettings());

        var controller = new OperationsMetricsSettingsController(mockService.Object);

        var actionResult = await controller.Get(CancellationToken.None);
        var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        var model = Assert.IsType<OperationsMetricsSettings>(okResult.Value);

        Assert.NotNull(model);
        Assert.Equal(95, model.Otif.TargetPercentage);
    }
}
