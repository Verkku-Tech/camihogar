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

    public async Task<IReadOnlyList<Ordina.Domain.Catalog.Category>> GetCategoriesAsync(CancellationToken cancellationToken = default)
    {
        // ponytail: 60s sliding cache avoids scanning categories on dashboard visits
        var cached = await _cache.GetAsync<IReadOnlyList<Ordina.Domain.Catalog.Category>>("dashboard:categories", cancellationToken);
        if (cached != null) return cached;

        var categories = await _context.Categories.Find(_ => true).ToListAsync(cancellationToken);
        await _cache.SetAsync("dashboard:categories", (IReadOnlyList<Ordina.Domain.Catalog.Category>)categories, slidingExpiration: TimeSpan.FromSeconds(60), cancellationToken: cancellationToken);
        return categories;
    }

    public async Task<IReadOnlyList<Ordina.Domain.Users.User>> GetUsersAsync(CancellationToken cancellationToken = default)
    {
        var cached = await _cache.GetAsync<IReadOnlyList<Ordina.Domain.Users.User>>("dashboard:users", cancellationToken);
        if (cached != null) return cached;

        var users = await _context.Users.Find(_ => true).ToListAsync(cancellationToken);
        await _cache.SetAsync("dashboard:users", (IReadOnlyList<Ordina.Domain.Users.User>)users, slidingExpiration: TimeSpan.FromSeconds(60), cancellationToken: cancellationToken);
        return users;
    }

    public async Task<IReadOnlyList<Ordina.Domain.Stores.Store>> GetStoresAsync(CancellationToken cancellationToken = default)
    {
        var cached = await _cache.GetAsync<IReadOnlyList<Ordina.Domain.Stores.Store>>("dashboard:stores", cancellationToken);
        if (cached != null) return cached;

        var stores = await _context.Stores.Find(_ => true).ToListAsync(cancellationToken);
        await _cache.SetAsync("dashboard:stores", (IReadOnlyList<Ordina.Domain.Stores.Store>)stores, slidingExpiration: TimeSpan.FromSeconds(60), cancellationToken: cancellationToken);
        return stores;
    }

    public async Task<IReadOnlyList<Ordina.Domain.Finance.Commission>> GetCommissionsAsync(CancellationToken cancellationToken = default)
    {
        var cached = await _cache.GetAsync<IReadOnlyList<Ordina.Domain.Finance.Commission>>("dashboard:commissions", cancellationToken);
        if (cached != null) return cached;

        var commissions = await _context.Commissions.Find(_ => true).ToListAsync(cancellationToken);
        await _cache.SetAsync("dashboard:commissions", (IReadOnlyList<Ordina.Domain.Finance.Commission>)commissions, slidingExpiration: TimeSpan.FromSeconds(60), cancellationToken: cancellationToken);
        return commissions;
    }

    public async Task<IReadOnlyList<Ordina.Domain.Finance.SaleTypeCommissionRule>> GetSaleTypeCommissionRulesAsync(CancellationToken cancellationToken = default)
    {
        var cached = await _cache.GetAsync<IReadOnlyList<Ordina.Domain.Finance.SaleTypeCommissionRule>>("dashboard:saletyperules", cancellationToken);
        if (cached != null) return cached;

        var rules = await _context.SaleTypeCommissionRules.Find(_ => true).ToListAsync(cancellationToken);
        await _cache.SetAsync("dashboard:saletyperules", (IReadOnlyList<Ordina.Domain.Finance.SaleTypeCommissionRule>)rules, slidingExpiration: TimeSpan.FromSeconds(60), cancellationToken: cancellationToken);
        return rules;
    }
}
