using System;
using System.Collections.Generic;

namespace Ordina.Application.Dashboard;

public record TimeSeriesPoint(DateTime Date, decimal Value);

public record ForecastResult(
    IReadOnlyList<decimal> ProjectedValues,
    double Alpha,
    double Beta,
    double Gamma,
    double MapeScore);

public interface ITimeSeriesForecastingService
{
    ForecastResult Forecast(
        IReadOnlyList<TimeSeriesPoint> history,
        int horizonSteps,
        int seasonalPeriod = 7,
        double damping = 0.92);
}
