using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Ordina.Application.Analytics;
using Ordina.Application.Dashboard;
using Ordina.Application.Notifications;
using Ordina.Domain.Notifications;

namespace Ordina.Infrastructure.BackgroundServices;

public class OperationsMetricsAlertWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OperationsMetricsAlertWorker> _logger;
    private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(15);

    public OperationsMetricsAlertWorker(IServiceScopeFactory scopeFactory, ILogger<OperationsMetricsAlertWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // ponytail: Initial delay to let DB connections settle
        await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckAndPublishMetricsAlertsAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Error checking operational metrics alerts in worker");
            }

            await Task.Delay(CheckInterval, stoppingToken);
        }
    }

    public async Task<int> CheckAndPublishMetricsAlertsAsync(CancellationToken ct, bool forceRun = false)
    {
        using var scope = _scopeFactory.CreateScope();
        var metricsService = scope.ServiceProvider.GetRequiredService<IOperationsMetricsSettingsService>();
        var ruleService = scope.ServiceProvider.GetRequiredService<INotificationRuleSettingsService>();
        var dashboardService = scope.ServiceProvider.GetRequiredService<IDashboardService>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var metricsSettings = await metricsService.GetSettingsAsync(ct);
        var rules = await ruleService.GetSettingsAsync(ct);

        if (!rules.BiAlertsEnabled && !forceRun) return 0;

        // Venezuela local time (UTC-4)
        var vzlaTime = DateTime.UtcNow.AddHours(-4);
        var isScheduledDay = vzlaTime.DayOfWeek == rules.BiDayOfWeek;
        var isScheduledHour = vzlaTime.Hour >= rules.BiHourOfDay;
        var alreadySentThisWeek = metricsSettings.LastAlertSentUtc.HasValue &&
            (DateTime.UtcNow - metricsSettings.LastAlertSentUtc.Value).TotalDays < 6;

        if (!forceRun && (!isScheduledDay || !isScheduledHour || alreadySentThisWeek))
        {
            return 0;
        }

        var leadTimes = await dashboardService.GetManufacturingLeadTimeAsync("month", ct);
        var otif = await dashboardService.GetOtifMetricsAsync("month", ct);
        var dwellTimes = await dashboardService.GetStageDwellTimesAsync(ct);
        var fulfillment = await dashboardService.GetFulfillmentRatioAsync("month", ct);

        var alerts = OperationsMetricsEvaluator.Evaluate(metricsSettings, leadTimes, otif, dwellTimes, fulfillment);
        if (alerts.Count == 0) return 0;

        var hasCritical = alerts.Any(a => a.Severity == "error");
        var topAlertDescriptions = string.Join("; ", alerts.Take(3).Select(a => a.Description));
        var summaryMessage = $"Se detectaron {alerts.Count} desvíos en métricas de operaciones: {topAlertDescriptions}.";

        await notificationService.PublishAsync(new CreateNotificationDto(
            Type: "OperationsMetricsAlert",
            Title: "Reporte de Métricas Operativas Fuera de Rango",
            Message: summaryMessage,
            Severity: hasCritical ? "error" : "warning",
            Link: "/dashboard",
            TargetRoles: rules.BiTargetRoles), ct);

        metricsSettings.LastAlertSentUtc = DateTime.UtcNow;
        await metricsService.UpdateSettingsAsync(metricsSettings, ct);

        return alerts.Count;
    }
}
