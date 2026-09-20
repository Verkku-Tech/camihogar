using System;
using System.Collections.Generic;
using System.Linq;

namespace Ordina.Application.Dashboard;

public class HoltWintersForecastingService : ITimeSeriesForecastingService
{
    private static readonly double[] CandidateAlphas = { 0.1, 0.2, 0.3, 0.4, 0.5, 0.6 };
    private static readonly double[] CandidateBetas  = { 0.02, 0.05, 0.1, 0.15, 0.2 };
    private static readonly double[] CandidateGammas = { 0.1, 0.2, 0.3, 0.4, 0.5 };

    public ForecastResult Forecast(
        IReadOnlyList<TimeSeriesPoint> history,
        int horizonSteps,
        int seasonalPeriod = 7,
        double damping = 0.92)
    {
        if (horizonSteps <= 0)
        {
            return new ForecastResult(Array.Empty<decimal>(), 0.2, 0.1, 0.2, 0.0);
        }

        if (history == null || history.Count == 0)
        {
            return new ForecastResult(Enumerable.Repeat(0m, horizonSteps).ToList(), 0.2, 0.1, 0.2, 0.0);
        }

        var values = history.Select(h => (double)h.Value).ToArray();
        int n = values.Length;

        // If not enough points for at least two full seasonal cycles, fallback to damped linear trend / moving average
        if (n < 2 * seasonalPeriod || seasonalPeriod <= 1)
        {
            return FallbackDampedLinearForecast(values, horizonSteps, damping);
        }

        // 1. Grid Search for Best Parameters (min RMSE)
        double bestRmse = double.MaxValue;
        double bestAlpha = 0.3;
        double bestBeta = 0.05;
        double bestGamma = 0.2;

        foreach (var a in CandidateAlphas)
        {
            foreach (var b in CandidateBetas)
            {
                foreach (var g in CandidateGammas)
                {
                    double rmse = EvaluateRmse(values, seasonalPeriod, damping, a, b, g);
                    if (rmse < bestRmse)
                    {
                        bestRmse = rmse;
                        bestAlpha = a;
                        bestBeta = b;
                        bestGamma = g;
                    }
                }
            }
        }

        // 2. Final Run with Best Parameters
        var (level, trend, seasons, mape) = FitModel(values, seasonalPeriod, damping, bestAlpha, bestBeta, bestGamma);

        // 3. Project Future Horizon Steps
        var projections = new List<decimal>(horizonSteps);
        double cumDamp = 0.0;

        for (int h = 1; h <= horizonSteps; h++)
        {
            cumDamp += Math.Pow(damping, h);
            int seasonIdx = (n - seasonalPeriod + ((h - 1) % seasonalPeriod)) % seasons.Length;
            if (seasonIdx < 0) seasonIdx += seasons.Length;

            double projected = level + (cumDamp * trend) + seasons[seasonIdx];
            projected = Math.Max(0.0, projected);

            projections.Add(Math.Round((decimal)projected, 2));
        }

        return new ForecastResult(projections, bestAlpha, bestBeta, bestGamma, Math.Round(mape, 2));
    }

    private static double EvaluateRmse(
        double[] y,
        int m,
        double phi,
        double alpha,
        double beta,
        double gamma)
    {
        int n = y.Length;
        double l = y.Take(m).Average();
        double b = 0.0;
        for (int i = 0; i < m; i++)
        {
            b += (y[i + m] - y[i]) / m;
        }
        b /= m;

        var s = new double[m];
        for (int i = 0; i < m; i++)
        {
            s[i] = y[i] - l;
        }

        double sMean = s.Average();
        for (int i = 0; i < m; i++) s[i] -= sMean;

        double sumSqErr = 0.0;
        int count = 0;

        for (int t = m; t < n; t++)
        {
            int sIdx = (t - m) % m;
            double yHat = l + (phi * b) + s[sIdx];
            double err = y[t] - yHat;
            sumSqErr += err * err;
            count++;

            double prevL = l;
            l = alpha * (y[t] - s[sIdx]) + (1 - alpha) * (l + phi * b);
            b = beta * (l - prevL) + (1 - beta) * phi * b;
            s[sIdx] = gamma * (y[t] - l) + (1 - gamma) * s[sIdx];
        }

        return count > 0 ? Math.Sqrt(sumSqErr / count) : 0.0;
    }

    private static (double Level, double Trend, double[] Seasons, double Mape) FitModel(
        double[] y,
        int m,
        double phi,
        double alpha,
        double beta,
        double gamma)
    {
        int n = y.Length;
        double l = y.Take(m).Average();
        double b = 0.0;
        for (int i = 0; i < m; i++)
        {
            b += (y[i + m] - y[i]) / m;
        }
        b /= m;

        var s = new double[m];
        for (int i = 0; i < m; i++)
        {
            s[i] = y[i] - l;
        }

        double sMean = s.Average();
        for (int i = 0; i < m; i++) s[i] -= sMean;

        double totalApe = 0.0;
        int apeCount = 0;

        for (int t = m; t < n; t++)
        {
            int sIdx = (t - m) % m;
            double yHat = Math.Max(0.0, l + (phi * b) + s[sIdx]);

            if (y[t] > 0.01)
            {
                totalApe += Math.Abs((y[t] - yHat) / y[t]) * 100.0;
                apeCount++;
            }

            double prevL = l;
            l = alpha * (y[t] - s[sIdx]) + (1 - alpha) * (l + phi * b);
            b = beta * (l - prevL) + (1 - beta) * phi * b;
            s[sIdx] = gamma * (y[t] - l) + (1 - gamma) * s[sIdx];
        }

        double mape = apeCount > 0 ? Math.Min(totalApe / apeCount, 100.0) : 0.0;
        return (l, b, s, mape);
    }

    private static ForecastResult FallbackDampedLinearForecast(double[] values, int horizonSteps, double damping)
    {
        int n = values.Length;
        double mean = values.Average();
        double slope = 0.0;

        if (n >= 2)
        {
            double xMean = (n - 1) / 2.0;
            double numerator = 0.0;
            double denominator = 0.0;
            for (int i = 0; i < n; i++)
            {
                double xDiff = i - xMean;
                numerator += xDiff * (values[i] - mean);
                denominator += xDiff * xDiff;
            }
            if (denominator > 0.0001)
            {
                slope = (numerator / denominator) * 0.5; // Damped slope
            }
        }

        double lastValue = values[^1];
        var projections = new List<decimal>(horizonSteps);
        double cumDamp = 0.0;

        for (int h = 1; h <= horizonSteps; h++)
        {
            cumDamp += Math.Pow(damping, h);
            double val = Math.Max(0.0, lastValue + (cumDamp * slope));
            projections.Add(Math.Round((decimal)val, 2));
        }

        return new ForecastResult(projections, 0.2, 0.05, 0.1, 5.0);
    }
}
