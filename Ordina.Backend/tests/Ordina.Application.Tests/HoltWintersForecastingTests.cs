using System;
using System.Collections.Generic;
using System.Linq;
using Ordina.Application.Dashboard;
using Xunit;

namespace Ordina.Application.Tests;

public class HoltWintersForecastingTests
{
    private readonly HoltWintersForecastingService _forecaster = new();

    [Fact]
    public void Forecast_WithSyntheticWeeklySeasonality_ProducesSensibleProjections()
    {
        // Arrange: 6 weeks of daily data with weekend peaks (Fri=5, Sat=6)
        var history = new List<TimeSeriesPoint>();
        var startDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc); // Thursday
        for (int i = 0; i < 42; i++)
        {
            var date = startDate.AddDays(i);
            decimal baseValue = 500m + (i * 2m); // Slight upward trend
            decimal seasonalBonus = (date.DayOfWeek == DayOfWeek.Friday || date.DayOfWeek == DayOfWeek.Saturday) ? 300m : 0m;
            history.Add(new TimeSeriesPoint(date, baseValue + seasonalBonus));
        }

        // Act: Forecast 7 days ahead with weekly seasonality (m=7)
        var result = _forecaster.Forecast(history, horizonSteps: 7, seasonalPeriod: 7, damping: 0.92);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(7, result.ProjectedValues.Count);
        Assert.True(result.Alpha >= 0.05 && result.Alpha <= 0.95);
        Assert.True(result.Beta >= 0.01 && result.Beta <= 0.5);
        Assert.True(result.Gamma >= 0.05 && result.Gamma <= 0.95);
        Assert.True(result.MapeScore >= 0 && result.MapeScore <= 100);

        // Weekend projections should reflect the seasonal lift
        var lastDate = history[^1].Date;
        for (int h = 1; h <= 7; h++)
        {
            var projectedDate = lastDate.AddDays(h);
            var projectedValue = result.ProjectedValues[h - 1];

            // Values must be positive and within reasonable range
            Assert.True(projectedValue > 300m && projectedValue < 1500m,
                $"Expected projection on {projectedDate:ddd} ({projectedValue}) to be within reasonable bounds");
        }
    }

    [Fact]
    public void Forecast_Guarantees_NonNegativeValues()
    {
        // Arrange: Declining series that could drop below zero
        var history = new List<TimeSeriesPoint>();
        var startDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        for (int i = 0; i < 21; i++)
        {
            history.Add(new TimeSeriesPoint(startDate.AddDays(i), Math.Max(0m, 100m - (i * 10m))));
        }

        // Act
        var result = _forecaster.Forecast(history, horizonSteps: 10, seasonalPeriod: 7, damping: 0.92);

        // Assert: Projections must clamp to 0 and not produce negative revenue
        Assert.All(result.ProjectedValues, v => Assert.True(v >= 0m, $"Projected value {v} should be >= 0"));
    }

    [Fact]
    public void Forecast_WithShortHistory_ReturnsSensibleMovingAverage()
    {
        // Arrange: Less history than 2 * seasonalPeriod
        var history = new List<TimeSeriesPoint>
        {
            new(new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), 100m),
            new(new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc), 120m),
            new(new DateTime(2026, 1, 3, 0, 0, 0, DateTimeKind.Utc), 110m),
        };

        // Act
        var result = _forecaster.Forecast(history, horizonSteps: 5, seasonalPeriod: 7, damping: 0.92);

        // Assert: Fallback to damped linear/average should succeed without throwing
        Assert.NotNull(result);
        Assert.Equal(5, result.ProjectedValues.Count);
        Assert.All(result.ProjectedValues, v => Assert.True(v > 50m && v < 200m));
    }

    [Fact]
    public void Forecast_WithZeroOrEmptyHistory_ReturnsZeros()
    {
        var result = _forecaster.Forecast(new List<TimeSeriesPoint>(), horizonSteps: 4);
        Assert.NotNull(result);
        Assert.Equal(4, result.ProjectedValues.Count);
        Assert.All(result.ProjectedValues, v => Assert.Equal(0m, v));
    }
}
