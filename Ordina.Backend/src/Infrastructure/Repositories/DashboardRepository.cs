using MongoDB.Driver;
using Ordina.Application.Common;
using Ordina.Application.Dashboard;
using Ordina.Domain.Finance;
using Ordina.Domain.Orders;
using Ordina.Infrastructure.Mongo;

namespace Ordina.Infrastructure.Repositories;

public class DashboardRepository(MongoDbContext context, ICacheService cache) : IDashboardRepository
{
    public async Task<IReadOnlyList<Order>> GetAllOrdersForDashboardAsync(CancellationToken cancellationToken = default)
    {
        // ponytail: 20s sliding cache avoids 7 simultaneous collection scans on every dashboard visit
        var cached = await cache.GetAsync<IReadOnlyList<Order>>("dashboard:orders", cancellationToken);
        if (cached != null) return cached;

        // ponytail: exclude images and Cancelado orders directly at query time to avoid pulling 270MB of dead image data into memory
        var projection = Builders<Order>.Projection
            .Exclude("partialPayments.images")
            .Exclude("mixedPayments.images")
            .Exclude("products.images")
            .Exclude("originalProducts.images");

        var orders = await context.Orders.Find(o => o.StatusString != "Cancelado")
            .Project<Order>(projection)
            .ToListAsync(cancellationToken);
        await cache.SetAsync("dashboard:orders", (IReadOnlyList<Order>)orders, slidingExpiration: TimeSpan.FromSeconds(20), cancellationToken: cancellationToken);
        return orders;
    }

    public async Task<IReadOnlyList<ExchangeRate>> GetExchangeRatesAsync(CancellationToken cancellationToken = default)
    {
        var cached = await cache.GetAsync<IReadOnlyList<ExchangeRate>>("dashboard:rates", cancellationToken);
        if (cached != null) return cached;

        var rates = await context.ExchangeRates.Find(_ => true).ToListAsync(cancellationToken);
        await cache.SetAsync("dashboard:rates", (IReadOnlyList<ExchangeRate>)rates, slidingExpiration: TimeSpan.FromSeconds(30), cancellationToken: cancellationToken);
        return rates;
    }

    public async Task<IReadOnlyList<Ordina.Domain.Catalog.Category>> GetCategoriesAsync(CancellationToken cancellationToken = default)
    {
        // ponytail: 60s sliding cache avoids scanning categories on dashboard visits
        var cached = await cache.GetAsync<IReadOnlyList<Ordina.Domain.Catalog.Category>>("dashboard:categories", cancellationToken);
        if (cached != null) return cached;

        var categories = await context.Categories.Find(_ => true).ToListAsync(cancellationToken);
        await cache.SetAsync("dashboard:categories", (IReadOnlyList<Ordina.Domain.Catalog.Category>)categories, slidingExpiration: TimeSpan.FromSeconds(60), cancellationToken: cancellationToken);
        return categories;
    }

    public async Task<IReadOnlyList<Ordina.Domain.Users.User>> GetUsersAsync(CancellationToken cancellationToken = default)
    {
        var cached = await cache.GetAsync<IReadOnlyList<Ordina.Domain.Users.User>>("dashboard:users", cancellationToken);
        if (cached != null) return cached;

        var users = await context.Users.Find(_ => true).ToListAsync(cancellationToken);
        await cache.SetAsync("dashboard:users", (IReadOnlyList<Ordina.Domain.Users.User>)users, slidingExpiration: TimeSpan.FromSeconds(60), cancellationToken: cancellationToken);
        return users;
    }

    public async Task<IReadOnlyList<Ordina.Domain.Stores.Store>> GetStoresAsync(CancellationToken cancellationToken = default)
    {
        var cached = await cache.GetAsync<IReadOnlyList<Ordina.Domain.Stores.Store>>("dashboard:stores", cancellationToken);
        if (cached != null) return cached;

        var stores = await context.Stores.Find(_ => true).ToListAsync(cancellationToken);
        await cache.SetAsync("dashboard:stores", (IReadOnlyList<Ordina.Domain.Stores.Store>)stores, slidingExpiration: TimeSpan.FromSeconds(60), cancellationToken: cancellationToken);
        return stores;
    }

    public async Task<IReadOnlyList<Ordina.Domain.Finance.Commission>> GetCommissionsAsync(CancellationToken cancellationToken = default)
    {
        var cached = await cache.GetAsync<IReadOnlyList<Ordina.Domain.Finance.Commission>>("dashboard:commissions", cancellationToken);
        if (cached != null) return cached;

        var commissions = await context.Commissions.Find(_ => true).ToListAsync(cancellationToken);
        await cache.SetAsync("dashboard:commissions", (IReadOnlyList<Ordina.Domain.Finance.Commission>)commissions, slidingExpiration: TimeSpan.FromSeconds(60), cancellationToken: cancellationToken);
        return commissions;
    }

    public async Task<IReadOnlyList<Ordina.Domain.Finance.SaleTypeCommissionRule>> GetSaleTypeCommissionRulesAsync(CancellationToken cancellationToken = default)
    {
        var cached = await cache.GetAsync<IReadOnlyList<Ordina.Domain.Finance.SaleTypeCommissionRule>>("dashboard:saletyperules", cancellationToken);
        if (cached != null) return cached;

        var rules = await context.SaleTypeCommissionRules.Find(_ => true).ToListAsync(cancellationToken);
        await cache.SetAsync("dashboard:saletyperules", (IReadOnlyList<Ordina.Domain.Finance.SaleTypeCommissionRule>)rules, slidingExpiration: TimeSpan.FromSeconds(60), cancellationToken: cancellationToken);
        return rules;
    }
    public async Task<IReadOnlyList<Ordina.Domain.Stores.Warehouse>> GetWarehousesAsync(CancellationToken cancellationToken = default)
    {
        var cached = await cache.GetAsync<IReadOnlyList<Ordina.Domain.Stores.Warehouse>>("dashboard:warehouses", cancellationToken);
        if (cached != null) return cached;

        var warehouses = await context.Warehouses.Find(_ => true).ToListAsync(cancellationToken);
        await cache.SetAsync("dashboard:warehouses", (IReadOnlyList<Ordina.Domain.Stores.Warehouse>)warehouses, slidingExpiration: TimeSpan.FromSeconds(60), cancellationToken: cancellationToken);
        return warehouses;
    }

    public async Task<IReadOnlyList<Ordina.Domain.Inventory.PhysicalStock>> GetPhysicalStocksAsync(CancellationToken cancellationToken = default)
    {
        var cached = await cache.GetAsync<IReadOnlyList<Ordina.Domain.Inventory.PhysicalStock>>("dashboard:stocks", cancellationToken);
        if (cached != null) return cached;

        var stocks = await context.PhysicalStocks.Find(_ => true).ToListAsync(cancellationToken);
        await cache.SetAsync("dashboard:stocks", (IReadOnlyList<Ordina.Domain.Inventory.PhysicalStock>)stocks, slidingExpiration: TimeSpan.FromSeconds(20), cancellationToken: cancellationToken);
        return stocks;
    }
}
