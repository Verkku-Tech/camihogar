using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Ordina.Application.Inventory;
using Ordina.Application.Orders;

namespace Ordina.Infrastructure.BackgroundServices;

public class StockReservationCleanupWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<StockReservationCleanupWorker> _logger;
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(60);

    public StockReservationCleanupWorker(IServiceScopeFactory scopeFactory, ILogger<StockReservationCleanupWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // ponytail: Short initial delay to let API boot up before first cleanup pass
        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var reservationService = scope.ServiceProvider.GetRequiredService<IStockReservationService>();
                var cleaned = await reservationService.CleanupExpiredReservationsAsync(stoppingToken);
                if (cleaned > 0)
                {
                    _logger.LogInformation("StockReservationCleanupWorker liberó {Count} reserva(s) vencidas.", cleaned);
                }

                // Check CRM repesca for old inactive reservations (> 30 days)
                var orderService = scope.ServiceProvider.GetService<IOrderCoreService>();
                if (orderService != null)
                {
                    var repescaCount = await orderService.CheckReservationRepescaAsync(stoppingToken);
                    if (repescaCount > 0)
                    {
                        _logger.LogInformation("StockReservationCleanupWorker notificó {Count} oportunidad(es) de repesca CRM.", repescaCount);
                    }
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Error durante la limpieza de reservas temporales vencidas.");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }
}
