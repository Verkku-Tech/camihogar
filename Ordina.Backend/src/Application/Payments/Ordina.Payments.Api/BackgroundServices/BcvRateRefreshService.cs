using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Ordina.Payments.Application.Interfaces;

namespace Ordina.Payments.Api.BackgroundServices;

/// <summary>
/// Cada medianoche Venezuela (04:00 UTC) intenta obtener tasas del BCV y guardarlas.
/// Si falla, reintenta una vez tras 2 horas.
/// Al arrancar el servidor, si faltan tasas del día, intenta obtenerlas (bootstrap).
/// </summary>
public sealed class BcvRateRefreshService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<BcvRateRefreshService> _logger;

    public BcvRateRefreshService(
        IServiceScopeFactory scopeFactory,
        ILogger<BcvRateRefreshService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
            await RunWithRetryAsync(stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                var delay = ComputeDelayUntilNextVenezuelaMidnightUtc();
                _logger.LogInformation(
                    "BCV refresh: próxima ejecución programada en {Delay} (UTC {NextUtc:O})",
                    delay,
                    DateTime.UtcNow.Add(delay));

                await Task.Delay(delay, stoppingToken);
                await RunWithRetryAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // apagado normal
        }
    }

    /// <summary>
    /// 00:00 hora Venezuela = 04:00 UTC (Venezuela no usa DST).
    /// </summary>
    internal static TimeSpan ComputeDelayUntilNextVenezuelaMidnightUtc()
    {
        var now = DateTime.UtcNow;
        var nextRun = now.Date.AddHours(4);
        if (now >= nextRun)
        {
            nextRun = nextRun.AddDays(1);
        }

        return nextRun - now;
    }

    private async Task RunWithRetryAsync(CancellationToken stoppingToken)
    {
        try
        {
            var ok = await TrySaveRatesAsync(stoppingToken);
            if (ok)
            {
                return;
            }

            _logger.LogWarning("BCV refresh: primer intento fallido; reintento en 2 horas.");
            await Task.Delay(TimeSpan.FromHours(2), stoppingToken);
            var okRetry = await TrySaveRatesAsync(stoppingToken);
            if (!okRetry)
            {
                _logger.LogError("BCV refresh: segundo intento fallido; se reintentará en la próxima ventana programada.");
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "BCV refresh: error en RunWithRetryAsync");
        }
    }

    private async Task<bool> TrySaveRatesAsync(CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var scraper = scope.ServiceProvider.GetRequiredService<IBcvScraperService>();
        var rateService = scope.ServiceProvider.GetRequiredService<IExchangeRateService>();

        var usdLatest = await rateService.GetLatestRateAsync("Bs", "USD");
        var eurLatest = await rateService.GetLatestRateAsync("Bs", "EUR");
        if (usdLatest is not null && eurLatest is not null)
        {
            _logger.LogInformation("BCV refresh: ya existen tasas activas para hoy (Bs→USD y Bs→EUR).");
            return true;
        }

        var (dolar, euro) = await scraper.FetchRatesAsync(stoppingToken);

        if (usdLatest is null && dolar is { } d)
        {
            var rounded = Math.Round(d, 4, MidpointRounding.AwayFromZero);
            await rateService.SetExchangeRateAsync("Bs", "USD", rounded);
            _logger.LogInformation("BCV refresh: guardada tasa USD = {Rate}", rounded);
        }

        if (eurLatest is null && euro is { } e)
        {
            var rounded = Math.Round(e, 4, MidpointRounding.AwayFromZero);
            await rateService.SetExchangeRateAsync("Bs", "EUR", rounded);
            _logger.LogInformation("BCV refresh: guardada tasa EUR = {Rate}", rounded);
        }

        usdLatest = await rateService.GetLatestRateAsync("Bs", "USD");
        eurLatest = await rateService.GetLatestRateAsync("Bs", "EUR");
        var success = usdLatest is not null && eurLatest is not null;

        if (!success)
        {
            _logger.LogWarning(
                "BCV refresh: no se pudieron obtener/guardar ambas tasas. USD ok={UsdOk}, EUR ok={EurOk}",
                usdLatest is not null,
                eurLatest is not null);
        }

        return success;
    }
}
