using Ordina.Application.Dashboard;
using Ordina.Domain.Analytics;

namespace Ordina.Application.Analytics;

public record MetricAlertItem(string MetricName, string Severity, string Description);

public static class OperationsMetricsEvaluator
{
    public static List<MetricAlertItem> Evaluate(
        OperationsMetricsSettings settings,
        IReadOnlyList<ManufacturingLeadTimeDto> leadTimes,
        OtifMetricsDto? otif,
        IReadOnlyList<StageDwellTimeDto> dwellTimes,
        FulfillmentRatioDto? fulfillment)
    {
        var alerts = new List<MetricAlertItem>();

        // 1. Lead times
        foreach (var lt in leadTimes)
        {
            var category = lt.Category ?? string.Empty;
            var threshold = settings.CategoryLeadTimes.TryGetValue(category, out var t)
                ? t
                : settings.DefaultLeadTime;

            var warningLimit = threshold.MaxStandardDays * (1 + threshold.WarningExtraPercentage / 100.0);
            var criticalLimit = threshold.MaxStandardDays * (1 + threshold.CriticalExtraPercentage / 100.0);

            if (lt.AverageDays >= criticalLimit)
            {
                alerts.Add(new MetricAlertItem(
                    $"Lead Time ({category})",
                    "error",
                    $"{category}: {lt.AverageDays:N1} d excede el límite crítico ({criticalLimit:N1} d)"));
            }
            else if (lt.AverageDays > warningLimit)
            {
                alerts.Add(new MetricAlertItem(
                    $"Lead Time ({category})",
                    "warning",
                    $"{category}: {lt.AverageDays:N1} d excede el límite estándar ({warningLimit:N1} d)"));
            }
        }

        // 2. OTIF
        if (otif != null)
        {
            var otifRate = (double)otif.OtifRate;
            if (otifRate < settings.Otif.CriticalPercentage)
            {
                alerts.Add(new MetricAlertItem(
                    "Cumplimiento OTIF",
                    "error",
                    $"OTIF en {otifRate:N1}% por debajo del nivel crítico ({settings.Otif.CriticalPercentage}%)"));
            }
            else if (otifRate < settings.Otif.WarningPercentage)
            {
                alerts.Add(new MetricAlertItem(
                    "Cumplimiento OTIF",
                    "warning",
                    $"OTIF en {otifRate:N1}% por debajo del nivel estándar ({settings.Otif.WarningPercentage}%)"));
            }
        }

        // 3. Cuellos de botella (Dwell Times)
        foreach (var dt in dwellTimes)
        {
            var stage = dt.StageName ?? string.Empty;
            if (settings.StageMaxStandardDays.TryGetValue(stage, out var maxDays))
            {
                if (dt.AverageDays > maxDays * 1.5)
                {
                    alerts.Add(new MetricAlertItem(
                        $"Cuello de Botella ({stage})",
                        "error",
                        $"{stage}: {dt.AverageDays:N1} d en espera (crítico vs {maxDays:N1} d)"));
                }
                else if (dt.AverageDays > maxDays * 1.3)
                {
                    alerts.Add(new MetricAlertItem(
                        $"Cuello de Botella ({stage})",
                        "warning",
                        $"{stage}: {dt.AverageDays:N1} d en espera (advertencia vs {maxDays:N1} d)"));
                }
            }
        }

        return alerts;
    }
}
