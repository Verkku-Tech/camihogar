using MongoDB.Driver;
using Ordina.Application.Common;
using Ordina.Application.Dashboard;
using Ordina.Domain.Finance;
using Ordina.Domain.Orders;
using Ordina.Infrastructure.Mongo;

namespace Ordina.Infrastructure.Repositories;

public class DashboardRepository : IDashboardRepository
{
    private readonly MongoDbContext _context;
    private readonly ICacheService _cache;

    public DashboardRepository(MongoDbContext context, ICacheService cache)
    {
        _context = context;
        _cache = cache;
    }

    public async Task<IReadOnlyList<Order>> GetAllOrdersForDashboardAsync(CancellationToken cancellationToken = default)
    {
        // ponytail: 20s sliding cache avoids 7 simultaneous collection scans on every dashboard visit
        var cached = await _cache.GetAsync<IReadOnlyList<Order>>("dashboard:orders", cancellationToken);
        if (cached != null) return cached;

        var orders = await _context.Orders.Find(_ => true).ToListAsync(cancellationToken);
        await _cache.SetAsync("dashboard:orders", (IReadOnlyList<Order>)orders, slidingExpiration: TimeSpan.FromSeconds(20), cancellationToken: cancellationToken);
        return orders;
    }

    public async Task<IReadOnlyList<ExchangeRate>> GetExchangeRatesAsync(CancellationToken cancellationToken = default)
    {
        var cached = await _cache.GetAsync<IReadOnlyList<ExchangeRate>>("dashboard:rates", cancellationToken);
        if (cached != null) return cached;

        var rates = await _context.ExchangeRates.Find(_ => true).ToListAsync(cancellationToken);
        await _cache.SetAsync("dashboard:rates", (IReadOnlyList<ExchangeRate>)rates, slidingExpiration: TimeSpan.FromSeconds(30), cancellationToken: cancellationToken);
        return rates;
    }
}
