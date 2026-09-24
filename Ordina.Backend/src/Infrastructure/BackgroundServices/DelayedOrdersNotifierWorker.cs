using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Ordina.Application.Common;
using Ordina.Application.Notifications;
using Ordina.Domain.Notifications;
using Ordina.Domain.Orders;

namespace Ordina.Infrastructure.BackgroundServices;

public class DelayedOrdersNotifierWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DelayedOrdersNotifierWorker> _logger;
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(30);

    public DelayedOrdersNotifierWorker(IServiceScopeFactory scopeFactory, ILogger<DelayedOrdersNotifierWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // ponytail: Initial wait allows application startup to complete
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckDelayedOrdersAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Error checking delayed orders and reservations in worker");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task CheckDelayedOrdersAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var orderRepo = scope.ServiceProvider.GetRequiredService<IOrderRepository>();
        var notificationRepo = scope.ServiceProvider.GetRequiredService<INotificationRepository>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();
        var ruleService = scope.ServiceProvider.GetService<INotificationRuleSettingsService>();
        var rules = ruleService != null ? await ruleService.GetSettingsAsync(ct) : new NotificationRuleSettings();

        // 1. Fabricación retrasada
        if (rules.ManufacturingDelayEnabled)
        {
            var delayDays = rules.ManufacturingDelayDays > 0 ? rules.ManufacturingDelayDays : 25;
            var delayedOrdersResult = await orderRepo.GetFilteredPagedAsync(1, 1, new OrderQueryFilter
            {
                LocationStatus = "FABRICACION",
                ProductFilterPreset = "fabricacion_retrasada"
            }, ct);

            if (delayedOrdersResult.TotalCount > 0)
            {
                var existing = await notificationRepo.GetActiveConsolidatedAsync("ManufacturingDelay", null, ct);
                if (existing == null)
                {
                    await notificationService.PublishAsync(new CreateNotificationDto(
                        Type: "ManufacturingDelay",
                        Title: "Alerta de retraso en fabricación",
                        Message: $"Hay {delayedOrdersResult.TotalCount} pedido(s) con más de {delayDays} días en fabricación sin cambio de estatus.",
                        Severity: "warning",
                        Link: "/pedidos/fabricacion?filter=delayed",
                        TargetRoles: new() { "Administrator", "Super Administrator", "Supervisor" }), ct);
                }
            }
        }

        // 2. Reservas vencidas
        if (rules.ReservationExpiringEnabled)
        {
            var expiringDays = rules.ReservationExpiringDays > 0 ? rules.ReservationExpiringDays : 30;
            var expiredReservations = await orderRepo.GetFilteredPagedAsync(1, 100, new OrderQueryFilter
            {
                Type = "Reservation",
                ProductFilterPreset = "reservas_vencidas"
            }, ct);

        if (expiredReservations.Items.Count > 0)
        {
            var byVendor = expiredReservations.Items
                .GroupBy(o => string.IsNullOrWhiteSpace(o.VendorId) ? (o.VendorName ?? "unknown") : o.VendorId);

            foreach (var group in byVendor)
            {
                var vendorKey = group.Key;
                var count = group.Count();
                var existing = await notificationRepo.GetActiveConsolidatedAsync("ReservationExpiring", vendorKey, ct);
                if (existing == null)
                {
                    await notificationService.PublishAsync(new CreateNotificationDto(
                        Type: "ReservationExpiring",
                        Title: "Expiración de reservas",
                        Message: $"Tienes {count} reserva(s) con más de {expiringDays} días sin concretar.",
                        Severity: "warning",
                        Link: "/pedidos/reservas?filter=expired",
                        TargetUserId: vendorKey != "unknown" ? vendorKey : null,
                        TargetRoles: new() { "Seller", "Vendedor", "Administrator", "Super Administrator" }), ct);
                }
            }
        }
    }
}
}
