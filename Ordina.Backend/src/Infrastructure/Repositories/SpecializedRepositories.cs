using MongoDB.Bson;
using MongoDB.Driver;
using Ordina.Application.Common;
using Ordina.Domain.Catalog;
using Ordina.Domain.Common;
using Ordina.Domain.Finance;
using Ordina.Domain.Orders;
using Ordina.Domain.Security;
using Ordina.Domain.Users;
using Ordina.Infrastructure.Mongo;

namespace Ordina.Infrastructure.Repositories;

public class OrderRepository : MongoRepository<Order>, IOrderRepository
{
    public OrderRepository(MongoDbContext context) : base(context.Database, "orders")
    {
    }

    public async Task<Order?> GetByOrderNumberAsync(string orderNumber, CancellationToken cancellationToken = default)
    {
        var filter = Builders<Order>.Filter.Eq(o => o.OrderNumber, orderNumber);
        return await _collection.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<string> GenerateOrderNumberAsync(string prefix, CancellationToken cancellationToken = default)
    {
        // Generar un número de secuencia incremental basado en el conteo + 1
        var filter = Builders<Order>.Filter.Regex(o => o.OrderNumber, new BsonRegularExpression($"^{prefix}-"));
        var count = await _collection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
        var nextNumber = count + 1;
        return $"{prefix}-{nextNumber:D5}";
    }

    public async Task<PagedResult<Order>> GetFilteredPagedAsync(int page, int pageSize, OrderQueryFilter queryFilter, CancellationToken cancellationToken = default)
    {
        var fb = Builders<Order>.Filter;
        var filters = new List<FilterDefinition<Order>>();

        var isReservationQuery =
            string.Equals(queryFilter.Type, "Reservation", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(queryFilter.Type, "PendingConfirmation", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(queryFilter.Status, "Reserva", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(queryFilter.Status, "Por Confirmar", StringComparison.OrdinalIgnoreCase);

        if (isReservationQuery)
        {
            if (!string.IsNullOrWhiteSpace(queryFilter.Type))
            {
                filters.Add(fb.Eq(o => o.TypeString, queryFilter.Type));
            }
            else
            {
                filters.Add(fb.Or(
                    fb.In(o => o.TypeString, new[] { "Reservation", "PendingConfirmation" }),
                    fb.Regex(o => o.OrderNumber, new BsonRegularExpression("^RES-", "i")),
                    fb.Regex(o => o.OrderNumber, new BsonRegularExpression("^PCF-", "i")),
                    fb.In(o => o.StatusString, new[] { "Reserva", "Por Confirmar" })
                ));
            }
        }
        else
        {
            // Regular orders list MUST strictly exclude reservations!
            filters.Add(fb.Nin(o => o.TypeString, new[] { "Reservation", "PendingConfirmation" }));
            filters.Add(fb.Not(fb.Regex(o => o.OrderNumber, new BsonRegularExpression("^RES-", "i"))));
            filters.Add(fb.Not(fb.Regex(o => o.OrderNumber, new BsonRegularExpression("^PCF-", "i"))));

            if (!string.IsNullOrWhiteSpace(queryFilter.Type))
            {
                filters.Add(fb.Eq(o => o.TypeString, queryFilter.Type));
            }
            else if (queryFilter.IncludeBudgets == false)
            {
                filters.Add(fb.Ne(o => o.TypeString, "Budget"));
                filters.Add(fb.Not(fb.Regex(o => o.OrderNumber, new BsonRegularExpression("^PRE-", "i"))));
            }
        }

        if (!string.IsNullOrWhiteSpace(queryFilter.Status))
        {
            filters.Add(fb.Eq(o => o.StatusString, queryFilter.Status));
        }

        if (!string.IsNullOrWhiteSpace(queryFilter.ExcludeStatuses))
        {
            var excludeList = queryFilter.ExcludeStatuses
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList();
            if (excludeList.Count > 0)
            {
                filters.Add(fb.Nin(o => o.StatusString, excludeList));
            }
        }

        if (!string.IsNullOrWhiteSpace(queryFilter.SaleType))
        {
            filters.Add(fb.Eq(o => o.SaleTypeString, queryFilter.SaleType));
        }

        if (!string.IsNullOrWhiteSpace(queryFilter.ProductFilterPreset))
        {
            var preset = queryFilter.ProductFilterPreset.Trim().ToLowerInvariant();
            switch (preset)
            {
                case "sistema_apartado_vencido":
                    var ninetyDaysAgo = DateTime.UtcNow.AddDays(-90);
                    filters.Add(fb.Eq(o => o.SaleTypeString, "sistema_apartado"));
                    filters.Add(fb.Lt(o => o.CreatedAt, ninetyDaysAgo));
                    filters.Add(fb.Nin(o => o.StatusString, new[] { "Declinado", "Cancelado", "Entregado", "Completado", "Completada" }));
                    break;
                case "por_despachar":
                    filters.Add(fb.ElemMatch(o => o.Products, p =>
                        p.LocationStatusString == null ||
                        p.LocationStatusString == "EN TIENDA" ||
                        p.LocationStatusString == "DISPONIBILIDAD INMEDIATA" ||
                        (p.LocationStatusString == "FABRICACION" && p.ManufacturingStatusString == "almacen_no_fabricado")));
                    break;
                case "fabricacion_retrasada":
                    var twentyFiveDaysAgo = DateTime.UtcNow.AddDays(-25);
                    filters.Add(fb.ElemMatch(o => o.Products, p => p.LocationStatusString == "FABRICACION" && p.ManufacturingStatusString != "fabricado"));
                    filters.Add(fb.Lt(o => o.UpdatedAt, twentyFiveDaysAgo));
                    filters.Add(fb.Nin(o => o.StatusString, new[] { "Declinado", "Cancelado", "Entregado", "Completado", "Completada" }));
                    break;
                case "reservas_vencidas":
                    var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
                    filters.Add(fb.Lt(o => o.CreatedAt, thirtyDaysAgo));
                    filters.Add(fb.Nin(o => o.StatusString, new[] { "Declinado", "Cancelado", "Entregado", "Completado", "Completada" }));
                    break;
                case "en_despacho":
                    filters.Add(fb.ElemMatch(o => o.Products, p => p.LocationStatusString == "EN DESPACHO"));
                    break;
                case "despachados":
                    filters.Add(fb.ElemMatch(o => o.Products, p => p.LocationStatusString == "DESPACHADO"));
                    break;
            }
        }

        if (!string.IsNullOrWhiteSpace(queryFilter.LocationStatus))
        {
            filters.Add(fb.ElemMatch(o => o.Products, p => p.LocationStatusString == queryFilter.LocationStatus));
        }

        if (!string.IsNullOrWhiteSpace(queryFilter.ManufacturingStatus))
        {
            filters.Add(fb.ElemMatch(o => o.Products, p => p.ManufacturingStatusString == queryFilter.ManufacturingStatus));
        }

        if (!string.IsNullOrWhiteSpace(queryFilter.Vendor))
        {
            var vTerm = System.Text.RegularExpressions.Regex.Escape(queryFilter.Vendor);
            filters.Add(fb.Or(
                fb.Eq(o => o.VendorId, queryFilter.Vendor),
                fb.Regex(o => o.VendorName, new BsonRegularExpression(vTerm, "i"))
            ));
        }

        if (!string.IsNullOrWhiteSpace(queryFilter.ClientId))
        {
            filters.Add(fb.Eq(o => o.ClientId, queryFilter.ClientId));
        }
        else if (!string.IsNullOrWhiteSpace(queryFilter.ClientSearch))
        {
            var cTerm = System.Text.RegularExpressions.Regex.Escape(queryFilter.ClientSearch);
            filters.Add(fb.Or(
                fb.Eq(o => o.ClientId, queryFilter.ClientSearch),
                fb.Regex(o => o.ClientName, new BsonRegularExpression(cTerm, "i"))
            ));
        }

        if (queryFilter.DateFrom.HasValue)
        {
            filters.Add(fb.Gte(o => o.CreatedAt, queryFilter.DateFrom.Value));
        }
        if (queryFilter.DateTo.HasValue)
        {
            filters.Add(fb.Lte(o => o.CreatedAt, queryFilter.DateTo.Value));
        }

        if (!string.IsNullOrWhiteSpace(queryFilter.SearchTerm))
        {
            var sTerm = System.Text.RegularExpressions.Regex.Escape(queryFilter.SearchTerm);
            filters.Add(fb.Or(
                fb.Regex(o => o.OrderNumber, new BsonRegularExpression(sTerm, "i")),
                fb.Regex(o => o.ClientName, new BsonRegularExpression(sTerm, "i")),
                fb.Regex(o => o.VendorName, new BsonRegularExpression(sTerm, "i"))
            ));
        }

        var combinedFilter = filters.Count > 0 ? fb.And(filters) : fb.Empty;
        var totalCount = await _collection.CountDocumentsAsync(combinedFilter, cancellationToken: cancellationToken);

        var items = await _collection.Find(combinedFilter)
            .SortByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<Order>(items, (int)totalCount, page, pageSize);
    }
}

public class UserRepository : MongoRepository<User>, IUserRepository
{
    public UserRepository(MongoDbContext context) : base(context.Database, "users")
    {
    }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        var filter = Builders<User>.Filter.Eq(u => u.Email, email.ToLowerInvariant());
        return await _collection.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<User?> GetByUsernameAsync(string username, CancellationToken cancellationToken = default)
    {
        var filter = Builders<User>.Filter.Eq(u => u.Username, username);
        return await _collection.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }
}

public class ClientRepository : MongoRepository<Client>, IClientRepository
{
    public ClientRepository(MongoDbContext context) : base(context.Database, "clients")
    {
    }

    public async Task<Client?> GetByRutAsync(string rutId, CancellationToken cancellationToken = default)
    {
        var filter = Builders<Client>.Filter.Eq(c => c.RutId, rutId);
        return await _collection.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }
}

public class ProductRepository : MongoRepository<Product>, IProductRepository
{
    public ProductRepository(MongoDbContext context) : base(context.Database, "products")
    {
    }

    public async Task<Product?> GetBySkuAsync(string sku, CancellationToken cancellationToken = default)
    {
        var filter = Builders<Product>.Filter.Eq(p => p.SKU, sku);
        return await _collection.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Product>> GetByCategoryIdAsync(string categoryId, CancellationToken cancellationToken = default)
    {
        var filter = Builders<Product>.Filter.Eq(p => p.CategoryId, categoryId);
        return await _collection.Find(filter).ToListAsync(cancellationToken);
    }
}

public class ExchangeRateRepository : MongoRepository<ExchangeRate>, IExchangeRateRepository
{
    public ExchangeRateRepository(MongoDbContext context) : base(context.Database, "exchangeRates")
    {
    }

    public async Task<ExchangeRate?> GetLatestRateAsync(string fromCurrency, string toCurrency, CancellationToken cancellationToken = default)
    {
        var filter = Builders<ExchangeRate>.Filter.And(
            Builders<ExchangeRate>.Filter.Eq(r => r.FromCurrency, fromCurrency),
            Builders<ExchangeRate>.Filter.Eq(r => r.ToCurrency, toCurrency),
            Builders<ExchangeRate>.Filter.Eq(r => r.IsActive, true));

        return await _collection.Find(filter)
            .SortByDescending(r => r.EffectiveDate)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ExchangeRate>> GetActiveRatesAsync(CancellationToken cancellationToken = default)
    {
        var filter = Builders<ExchangeRate>.Filter.Eq(r => r.IsActive, true);
        var rates = await _collection.Find(filter)
            .SortByDescending(r => r.EffectiveDate)
            .ToListAsync(cancellationToken);

        // Retornar la última tasa activa única para cada par de divisas
        return rates
            .GroupBy(r => $"{r.FromCurrency}_{r.ToCurrency}")
            .Select(g => g.First())
            .ToList();
    }

    public async Task DeactivatePreviousRatesAsync(string fromCurrency, string toCurrency, CancellationToken cancellationToken = default)
    {
        var filter = Builders<ExchangeRate>.Filter.And(
            Builders<ExchangeRate>.Filter.Eq(r => r.FromCurrency, fromCurrency),
            Builders<ExchangeRate>.Filter.Eq(r => r.ToCurrency, toCurrency),
            Builders<ExchangeRate>.Filter.Eq(r => r.IsActive, true));

        var update = Builders<ExchangeRate>.Update
            .Set(r => r.IsActive, false)
            .Set(r => r.UpdatedAt, DateTime.UtcNow);

        await _collection.UpdateManyAsync(filter, update, cancellationToken: cancellationToken);
    }
}

public class RefreshTokenRepository : MongoRepository<RefreshToken>, IRefreshTokenRepository
{
    public RefreshTokenRepository(MongoDbContext context) : base(context.Database, "refreshTokens")
    {
    }

    public async Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        var filter = Builders<RefreshToken>.Filter.Eq(r => r.Token, token);
        return await _collection.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task RevokeByUserIdAsync(string userId, CancellationToken cancellationToken = default)
    {
        var filter = Builders<RefreshToken>.Filter.Eq(r => r.UserId, userId);
        var update = Builders<RefreshToken>.Update.Set(r => r.IsRevoked, true).Set(r => r.UpdatedAt, DateTime.UtcNow);
        await _collection.UpdateManyAsync(filter, update, cancellationToken: cancellationToken);
    }
}

public class IdempotencyRepository : IIdempotencyRepository
{
    private readonly IMongoCollection<IdempotencyRecord> _collection;

    public IdempotencyRepository(MongoDbContext context)
    {
        _collection = context.IdempotencyRecords;
    }

    public async Task<IdempotencyRecord?> GetByMutationIdAsync(string mutationId, CancellationToken cancellationToken = default)
    {
        var filter = Builders<IdempotencyRecord>.Filter.Eq(x => x.MutationId, mutationId);
        return await _collection.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task SaveAsync(IdempotencyRecord record, CancellationToken cancellationToken = default)
    {
        await _collection.InsertOneAsync(record, cancellationToken: cancellationToken);
    }
}
