using Ordina.Application.Analytics;
using Ordina.Application.Dashboard;
using Ordina.Domain.Analytics;
using Xunit;

namespace Ordina.Application.Tests;

public class OperationsMetricsAlertWorkerTests
{
    [Fact]
    public void EvaluateMetrics_WhenLeadTimeExceedsCritical_GeneratesRedAlert()
    {
        var settings = new OperationsMetricsSettings();
        // Cama: standard 5-7d, critical extra +50% -> > 10.5d is Red
        var leadTimes = new List<ManufacturingLeadTimeDto>
        {
            new("Cama", 11.0, 10)
        };

        var alerts = OperationsMetricsEvaluator.Evaluate(settings, leadTimes, null, new List<StageDwellTimeDto>(), null);

        Assert.Single(alerts);
        Assert.Equal("error", alerts[0].Severity);
        Assert.Contains("Cama", alerts[0].MetricName);
    }

    [Fact]
    public void EvaluateMetrics_WhenAllInRange_GeneratesNoAlerts()
    {
        var settings = new OperationsMetricsSettings();
        var leadTimes = new List<ManufacturingLeadTimeDto>
        {
            new("Cama", 6.0, 10)
        };
        var otif = new OtifMetricsDto(97.0m, 100, 3, 103);

        var alerts = OperationsMetricsEvaluator.Evaluate(settings, leadTimes, otif, new List<StageDwellTimeDto>(), null);

        Assert.Empty(alerts);
    }
}
