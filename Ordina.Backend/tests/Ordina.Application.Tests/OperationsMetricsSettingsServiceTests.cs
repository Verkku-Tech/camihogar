using Moq;
using Ordina.Application.Analytics;
using Ordina.Application.Common;
using Ordina.Domain.Analytics;
using Ordina.Domain.Common;
using Xunit;

namespace Ordina.Application.Tests;

public class OperationsMetricsSettingsServiceTests
{
    [Fact]
    public async Task GetSettingsAsync_WhenNotExists_CreatesAndReturnsDefaultSettings()
    {
        var mockRepo = new Mock<IRepository<OperationsMetricsSettings>>();
        mockRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<OperationsMetricsSettings>());

        mockRepo.Setup(r => r.AddAsync(It.IsAny<OperationsMetricsSettings>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((OperationsMetricsSettings s, CancellationToken _) => s);

        var service = new OperationsMetricsSettingsService(mockRepo.Object);

        var result = await service.GetSettingsAsync();

        Assert.NotNull(result);
        Assert.Equal(95, result.Otif.TargetPercentage);
        mockRepo.Verify(r => r.AddAsync(It.IsAny<OperationsMetricsSettings>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateSettingsAsync_UpdatesExistingSettings()
    {
        var existing = new OperationsMetricsSettings { Id = "existing-id" };
        var mockRepo = new Mock<IRepository<OperationsMetricsSettings>>();
        mockRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<OperationsMetricsSettings> { existing });

        var service = new OperationsMetricsSettingsService(mockRepo.Object);

        var updated = new OperationsMetricsSettings
        {
            Otif = new OtifThreshold(98, 92, 85)
        };

        var result = await service.UpdateSettingsAsync(updated);

        Assert.Equal("existing-id", result.Id);
        Assert.Equal(98, result.Otif.TargetPercentage);
        mockRepo.Verify(r => r.UpdateAsync(It.Is<OperationsMetricsSettings>(s => s.Otif.TargetPercentage == 98), It.IsAny<CancellationToken>()), Times.Once);
    }
}
