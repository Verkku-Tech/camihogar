using System.Text.RegularExpressions;
using MongoDB.Bson;
using MongoDB.Driver;
using Ordina.Database.Entities.Order;
using Ordina.Database.Helpers;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class OrderRepository : IOrderRepository
{
    private readonly IMongoCollection<Order> _collection;
    private readonly MongoDbContext _context;

    public OrderRepository(MongoDbContext context)
    {
        _context = context;
        _collection = context.Orders;
    }

    internal static FilterDefinition<Order> BuildOnlineSellerTeamFilter(
        FilterDefinitionBuilder<Order> filterBuilder,
        IReadOnlyCollection<string> onlineSellerTeamIds)
    {
        var ids = onlineSellerTeamIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (ids.Count == 0)
            return filterBuilder.Where(_ => false);

        return filterBuilder.Or(
            filterBuilder.In(o => o.VendorId, ids),
            filterBuilder.In(o => o.ReferrerId, ids),
            filterBuilder.In(o => o.SourceReservationVendorId, ids));
    }

    private static FilterDefinition<Order> CombineFilters(
        FilterDefinition<Order> baseFilter,
        IReadOnlyCollection<string>? onlineSellerTeamIds)
    {
        if (onlineSellerTeamIds == null)
            return baseFilter;

        var fb = Builders<Order>.Filter;
        var teamFilter = BuildOnlineSellerTeamFilter(fb, onlineSellerTeamIds);
        return fb.And(baseFilter, teamFilter);
    }

    public async Task<Order?> GetByIdAsync(string id)
    {
        return await _collection.Find(o => o.Id == id).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<Order>> GetAllAsync(IReadOnlyCollection<string>? onlineSellerTeamIds = null)
    {
        var filter = CombineFilters(Builders<Order>.Filter.Empty, onlineSellerTeamIds);
        return await _collection.Find(filter)
            .SortByDescending(o => o.CreatedAt)
            .ToListAsync();
    }

    public async Task<(IEnumerable<Order> Orders, int TotalCount)> GetPagedAsync(
        int page,
        int pageSize,
        DateTime? since = null,
        IReadOnlyCollection<string>? onlineSellerTeamIds = null,
        CancellationToken cancellationToken = default)
    {
        var filterBuilder = Builders<Order>.Filter;
        var filter = filterBuilder.Empty;

        if (since.HasValue)
            filter = filterBuilder.Gte(o => o.UpdatedAt, since.Value);

        filter = CombineFilters(filter, onlineSellerTeamIds);

        var totalCount = await _collection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
        var skip = (page - 1) * pageSize;

        // Cuando se usa since (sync incremental), ordenar por UpdatedAt para traer los más recientes primero.
        // En carga completa, ordenar por CreatedAt descendente.
        var sortDefinition = since.HasValue
            ? Builders<Order>.Sort.Descending(o => o.UpdatedAt)
            : Builders<Order>.Sort.Descending(o => o.CreatedAt);

        var orders = await _collection.Find(filter)
            .Sort(sortDefinition)
            .Skip(skip)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);

        return (orders, (int)totalCount);
    }

    public async Task<(IEnumerable<Order> Orders, int TotalCount)> GetFilteredPagedAsync(
        int page,
        int pageSize,
        OrderListFilter listFilter,
        IReadOnlyCollection<string>? onlineSellerTeamIds = null,
        CancellationToken cancellationToken = default)
    {
        var fb = Builders<Order>.Filter;
        var filters = new List<FilterDefinition<Order>>();

        // Excluir reservas (misma lógica que SearchHeaderAsync)
        // Solo excluir cuando NO se está filtrando por un status de reserva específico
        var isReservationStatusFilter =
            string.Equals(listFilter.Status?.Trim(), "Reserva", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(listFilter.Status?.Trim(), "Por Confirmar", StringComparison.OrdinalIgnoreCase);

        if (!isReservationStatusFilter)
        {
            filters.Add(fb.Nin(o => o.Type, new[] { "Reservation", "PendingConfirmation" }));
            filters.Add(fb.Not(fb.Regex(o => o.OrderNumber, new BsonRegularExpression("^RES-"))));
            filters.Add(fb.Not(fb.Regex(o => o.OrderNumber, new BsonRegularExpression("^PCF-"))));
        }

        // Presupuestos convertidos
        filters.Add(fb.Not(fb.And(
            fb.Eq(o => o.Type, "Budget"),
            fb.In(o => o.Status, new[] { "Convertido", "convertido", "CONVERTIDO" }))));

        if (!listFilter.IncludeBudgets)
        {
            filters.Add(fb.Ne(o => o.Type, "Budget"));
        }

        if (!string.IsNullOrWhiteSpace(listFilter.Search))
        {
            var searchTokens = AccentInsensitiveRegex.Tokenize(listFilter.Search);
            if (searchTokens.Length > 0)
            {
                var tokenFilters = new List<FilterDefinition<Order>>();
                foreach (var token in searchTokens)
                {
                    var regex = AccentInsensitiveRegex.ToBsonRegex(token);
                    var cleanToken = Regex.Replace(token, @"^(#+|ORD-|PED-)", "", RegexOptions.IgnoreCase).Trim();
                    var tokenOr = new List<FilterDefinition<Order>>
                    {
                        fb.Regex(o => o.OrderNumber, regex),
                        fb.Regex(o => o.ClientName, regex),
                        fb.Regex(o => o.VendorName, regex),
                    };
                    if (!string.IsNullOrEmpty(cleanToken) && cleanToken != token)
                    {
                        tokenOr.Add(fb.Regex(o => o.OrderNumber, AccentInsensitiveRegex.ToBsonRegex(cleanToken)));
                    }
                    if (listFilter.MatchingClientIds is { Count: > 0 })
                    {
                        tokenOr.Add(fb.In(o => o.ClientId, listFilter.MatchingClientIds));
                    }
                    tokenFilters.Add(fb.Or(tokenOr));
                }
                filters.Add(fb.And(tokenFilters));
            }
        }

        if (!string.IsNullOrWhiteSpace(listFilter.ClientSearch))
        {
            var clientTokens = AccentInsensitiveRegex.Tokenize(listFilter.ClientSearch);
            if (clientTokens.Length > 0)
            {
                var clientTokenFilters = new List<FilterDefinition<Order>>();
                foreach (var token in clientTokens)
                {
                    var nameRegex = AccentInsensitiveRegex.ToBsonRegex(token);
                    var clientOr = new List<FilterDefinition<Order>>
                    {
                        fb.Regex(o => o.ClientName, nameRegex),
                    };
                    if (listFilter.MatchingClientIds is { Count: > 0 })
                    {
                        clientOr.Add(fb.In(o => o.ClientId, listFilter.MatchingClientIds));
                    }
                    clientTokenFilters.Add(fb.Or(clientOr));
                }
                filters.Add(fb.And(clientTokenFilters));
            }
        }

        if (!string.IsNullOrWhiteSpace(listFilter.Vendor))
        {
            filters.Add(fb.Eq(o => o.VendorName, listFilter.Vendor.Trim()));
        }

        if (!string.IsNullOrWhiteSpace(listFilter.Status))
        {
            filters.Add(fb.Eq(o => o.Status, listFilter.Status.Trim()));
        }

        if (!string.IsNullOrWhiteSpace(listFilter.SaleType))
        {
            filters.Add(fb.Eq(o => o.SaleType, listFilter.SaleType.Trim()));
        }

        if (listFilter.DateFrom.HasValue)
        {
            filters.Add(fb.Gte(o => o.CreatedAt, listFilter.DateFrom.Value.Date));
        }

        if (listFilter.DateTo.HasValue)
        {
            var end = listFilter.DateTo.Value.Date.AddDays(1).AddTicks(-1);
            filters.Add(fb.Lte(o => o.CreatedAt, end));
        }

        if (!string.IsNullOrWhiteSpace(listFilter.LocationStatus))
        {
            filters.Add(fb.ElemMatch(o => o.Products,
                p => p.LocationStatus == listFilter.LocationStatus.Trim()));
        }

        if (!string.IsNullOrWhiteSpace(listFilter.ManufacturingStatus))
        {
            var mfgTrimmed = listFilter.ManufacturingStatus.Trim();
            if (string.Equals(mfgTrimmed, "debe_fabricar", StringComparison.OrdinalIgnoreCase))
            {
                filters.Add(fb.ElemMatch(o => o.Products, p =>
                    (p.LocationStatus == "FABRICACION" || p.LocationStatus == null || p.LocationStatus == "")
                    && (p.ManufacturingStatus == null || p.ManufacturingStatus == "" || p.ManufacturingStatus == "debe_fabricar")));
            }
            else
            {
                filters.Add(fb.ElemMatch(o => o.Products,
                    p => p.ManufacturingStatus == mfgTrimmed));
            }
        }

        if (!string.IsNullOrWhiteSpace(listFilter.ExcludeStatuses))
        {
            var excludeList = listFilter.ExcludeStatuses
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => s.Trim())
                .ToList();
            if (excludeList.Count > 0)
            {
                filters.Add(fb.Nin(o => o.Status, excludeList));
            }
        }

        if (!string.IsNullOrWhiteSpace(listFilter.ProductFilterPreset))
        {
            var preset = listFilter.ProductFilterPreset.Trim().ToLowerInvariant();
            switch (preset)
            {
                case "por_despachar":
                    filters.Add(fb.ElemMatch(o => o.Products, p =>
                        p.LocationStatus == null
                        || p.LocationStatus == "EN TIENDA"
                        || p.LocationStatus == "DISPONIBILIDAD INMEDIATA"
                        || (p.LocationStatus == "FABRICACION" && p.ManufacturingStatus == "almacen_no_fabricado")));
                    break;
                case "en_despacho":
                    filters.Add(fb.ElemMatch(o => o.Products, p => p.LocationStatus == "EN DESPACHO"));
                    break;
                case "despachados":
                    filters.Add(fb.ElemMatch(o => o.Products, p => p.LocationStatus == "DESPACHADO"));
                    break;
            }
        }

        var filter = CombineFilters(fb.And(filters), onlineSellerTeamIds);

        var totalCount = await _collection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
        var skip = (page - 1) * pageSize;

        var orders = await _collection.Find(filter)
            .SortByDescending(o => o.CreatedAt)
            .Skip(skip)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);

        return (orders, (int)totalCount);
    }

    public async Task<int> GetFilteredCountAsync(
        OrderListFilter listFilter,
        IReadOnlyCollection<string>? onlineSellerTeamIds = null,
        CancellationToken cancellationToken = default)
    {
        var fb = Builders<Order>.Filter;
        var filters = new List<FilterDefinition<Order>>();

        var isReservationStatusFilter =
            string.Equals(listFilter.Status?.Trim(), "Reserva", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(listFilter.Status?.Trim(), "Por Confirmar", StringComparison.OrdinalIgnoreCase);

        if (!isReservationStatusFilter)
        {
            filters.Add(fb.Nin(o => o.Type, new[] { "Reservation", "PendingConfirmation" }));
            filters.Add(fb.Not(fb.Regex(o => o.OrderNumber, new BsonRegularExpression("^RES-", "i"))));
            filters.Add(fb.Not(fb.Regex(o => o.OrderNumber, new BsonRegularExpression("^PCF-", "i"))));
        }

        filters.Add(fb.Not(fb.And(
            fb.Eq(o => o.Type, "Budget"),
            fb.Regex(o => o.Status, new BsonRegularExpression("^convertido$", "i")))));

        if (!listFilter.IncludeBudgets)
        {
            filters.Add(fb.Ne(o => o.Type, "Budget"));
        }

        if (!string.IsNullOrWhiteSpace(listFilter.Search))
        {
            var searchTokens = AccentInsensitiveRegex.Tokenize(listFilter.Search);
            if (searchTokens.Length > 0)
            {
                var tokenFilters = new List<FilterDefinition<Order>>();
                foreach (var token in searchTokens)
                {
                    var regex = AccentInsensitiveRegex.ToBsonRegex(token);
                    var cleanToken = Regex.Replace(token, @"^(#+|ORD-|PED-)", "", RegexOptions.IgnoreCase).Trim();
                    var tokenOr = new List<FilterDefinition<Order>>
                    {
                        fb.Regex(o => o.OrderNumber, regex),
                        fb.Regex(o => o.ClientName, regex),
                        fb.Regex(o => o.VendorName, regex),
                    };
                    if (!string.IsNullOrEmpty(cleanToken) && cleanToken != token)
                    {
                        tokenOr.Add(fb.Regex(o => o.OrderNumber, AccentInsensitiveRegex.ToBsonRegex(cleanToken)));
                    }
                    if (listFilter.MatchingClientIds is { Count: > 0 })
                    {
                        tokenOr.Add(fb.In(o => o.ClientId, listFilter.MatchingClientIds));
                    }
                    tokenFilters.Add(fb.Or(tokenOr));
                }
                filters.Add(fb.And(tokenFilters));
            }
        }

        if (!string.IsNullOrWhiteSpace(listFilter.ClientSearch))
        {
            var clientTokens = AccentInsensitiveRegex.Tokenize(listFilter.ClientSearch);
            if (clientTokens.Length > 0)
            {
                var clientTokenFilters = new List<FilterDefinition<Order>>();
                foreach (var token in clientTokens)
                {
                    var nameRegex = AccentInsensitiveRegex.ToBsonRegex(token);
                    var clientOr = new List<FilterDefinition<Order>>
                    {
                        fb.Regex(o => o.ClientName, nameRegex),
                    };
                    if (listFilter.MatchingClientIds is { Count: > 0 })
                    {
                        clientOr.Add(fb.In(o => o.ClientId, listFilter.MatchingClientIds));
                    }
                    clientTokenFilters.Add(fb.Or(clientOr));
                }
                filters.Add(fb.And(clientTokenFilters));
            }
        }

        if (!string.IsNullOrWhiteSpace(listFilter.Vendor))
        {
            filters.Add(fb.Eq(o => o.VendorName, listFilter.Vendor.Trim()));
        }

        if (!string.IsNullOrWhiteSpace(listFilter.Status))
        {
            filters.Add(fb.Eq(o => o.Status, listFilter.Status.Trim()));
        }

        if (!string.IsNullOrWhiteSpace(listFilter.SaleType))
        {
            filters.Add(fb.Eq(o => o.SaleType, listFilter.SaleType.Trim()));
        }

        if (listFilter.DateFrom.HasValue)
        {
            filters.Add(fb.Gte(o => o.CreatedAt, listFilter.DateFrom.Value.Date));
        }

        if (listFilter.DateTo.HasValue)
        {
            var end = listFilter.DateTo.Value.Date.AddDays(1).AddTicks(-1);
            filters.Add(fb.Lte(o => o.CreatedAt, end));
        }

        if (!string.IsNullOrWhiteSpace(listFilter.LocationStatus))
        {
            filters.Add(fb.ElemMatch(o => o.Products,
                p => p.LocationStatus == listFilter.LocationStatus.Trim()));
        }

        if (!string.IsNullOrWhiteSpace(listFilter.ManufacturingStatus))
        {
            var mfgTrimmed = listFilter.ManufacturingStatus.Trim();
            if (string.Equals(mfgTrimmed, "debe_fabricar", StringComparison.OrdinalIgnoreCase))
            {
                filters.Add(fb.ElemMatch(o => o.Products, p =>
                    (p.LocationStatus == "FABRICACION" || p.LocationStatus == null || p.LocationStatus == "")
                    && (p.ManufacturingStatus == null || p.ManufacturingStatus == "" || p.ManufacturingStatus == "debe_fabricar")));
            }
            else
            {
                filters.Add(fb.ElemMatch(o => o.Products,
                    p => p.ManufacturingStatus == mfgTrimmed));
            }
        }

        if (!string.IsNullOrWhiteSpace(listFilter.ExcludeStatuses))
        {
            var excludeList = listFilter.ExcludeStatuses
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => s.Trim())
                .ToList();
            if (excludeList.Count > 0)
            {
                filters.Add(fb.Nin(o => o.Status, excludeList));
            }
        }

        if (!string.IsNullOrWhiteSpace(listFilter.ProductFilterPreset))
        {
            var preset = listFilter.ProductFilterPreset.Trim().ToLowerInvariant();
            switch (preset)
            {
                case "por_despachar":
                    filters.Add(fb.ElemMatch(o => o.Products, p =>
                        p.LocationStatus == null
                        || p.LocationStatus == "EN TIENDA"
                        || p.LocationStatus == "DISPONIBILIDAD INMEDIATA"
                        || (p.LocationStatus == "FABRICACION" && p.ManufacturingStatus == "almacen_no_fabricado")));
                    break;
                case "en_despacho":
                    filters.Add(fb.ElemMatch(o => o.Products, p => p.LocationStatus == "EN DESPACHO"));
                    break;
                case "despachados":
                    filters.Add(fb.ElemMatch(o => o.Products, p => p.LocationStatus == "DESPACHADO"));
                    break;
            }
        }

        var filter = CombineFilters(fb.And(filters), onlineSellerTeamIds);

        return (int)await _collection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
    }

    public async Task<int> GetCountAsync(
        IReadOnlyCollection<string>? onlineSellerTeamIds = null,
        DateTime? since = null,
        CancellationToken cancellationToken = default)
    {
        var filterBuilder = Builders<Order>.Filter;
        var filter = filterBuilder.Empty;

        if (since.HasValue)
            filter = filterBuilder.Gte(o => o.UpdatedAt, since.Value);

        filter = CombineFilters(filter, onlineSellerTeamIds);

        return (int)await _collection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
    }

    public async Task<IEnumerable<Order>> GetByClientIdAsync(
        string clientId,
        IReadOnlyCollection<string>? onlineSellerTeamIds = null)
    {
        var filter = CombineFilters(
            Builders<Order>.Filter.Eq(o => o.ClientId, clientId),
            onlineSellerTeamIds);

        return await _collection.Find(filter)
            .SortByDescending(o => o.CreatedAt)
            .ToListAsync();
    }

    public async Task<IEnumerable<Order>> GetByStatusAsync(
        string status,
        IReadOnlyCollection<string>? onlineSellerTeamIds = null)
    {
        var filter = CombineFilters(
            Builders<Order>.Filter.Eq(o => o.Status, status),
            onlineSellerTeamIds);

        return await _collection.Find(filter)
            .SortByDescending(o => o.CreatedAt)
            .ToListAsync();
    }

    public async Task<IEnumerable<Order>> GetByCreatedAtRangeAsync(
        DateTime startInclusive,
        DateTime endInclusive,
        IReadOnlyCollection<string>? onlineSellerTeamIds = null)
    {
        var filterBuilder = Builders<Order>.Filter;
        var dateFilter = filterBuilder.And(
            filterBuilder.Gte(o => o.CreatedAt, startInclusive),
            filterBuilder.Lte(o => o.CreatedAt, endInclusive));

        var filter = CombineFilters(dateFilter, onlineSellerTeamIds);

        return await _collection.Find(filter)
            .SortByDescending(o => o.CreatedAt)
            .ToListAsync();
    }

    public async Task<Order?> GetByOrderNumberAsync(string orderNumber)
    {
        return await _collection.Find(o => o.OrderNumber == orderNumber).FirstOrDefaultAsync();
    }

    public async Task<IReadOnlyList<Order>> SearchHeaderAsync(
        string query,
        IReadOnlyCollection<string>? matchingClientIds,
        int limit,
        IReadOnlyCollection<string>? onlineSellerTeamIds = null)
    {
        if (string.IsNullOrWhiteSpace(query) || limit <= 0)
        {
            return Array.Empty<Order>();
        }

        var fb = Builders<Order>.Filter;

        var tokens = AccentInsensitiveRegex.Tokenize(query);
        if (tokens.Length == 0)
        {
            return Array.Empty<Order>();
        }

        var tokenFilters = new List<FilterDefinition<Order>>();
        foreach (var token in tokens)
        {
            var regex = AccentInsensitiveRegex.ToBsonRegex(token);
            var orFilters = new List<FilterDefinition<Order>>
            {
                fb.Regex(o => o.OrderNumber, regex),
                fb.Regex(o => o.ClientName, regex),
            };

            if (matchingClientIds is { Count: > 0 })
            {
                orFilters.Add(fb.In(o => o.ClientId, matchingClientIds));
            }
            tokenFilters.Add(fb.Or(orFilters));
        }

        var searchFilter = fb.And(tokenFilters);
        var filter = CombineFilters(searchFilter, onlineSellerTeamIds);

        return await _collection.Find(filter)
            .SortByDescending(o => o.CreatedAt)
            .Limit(limit)
            .ToListAsync();
    }

    public async Task<Order> CreateAsync(Order order)
    {
        order.CreatedAt = DateTime.UtcNow;
        order.UpdatedAt = DateTime.UtcNow;
        await _collection.InsertOneAsync(order);
        return order;
    }

    public async Task<Order> UpdateAsync(Order order)
    {
        order.UpdatedAt = DateTime.UtcNow;
        await _collection.ReplaceOneAsync(o => o.Id == order.Id, order);
        return order;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _collection.DeleteOneAsync(o => o.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<bool> ExistsAsync(string id)
    {
        var count = await _collection.CountDocumentsAsync(o => o.Id == id);
        return count > 0;
    }

    public async Task<bool> OrderNumberExistsAsync(string orderNumber)
    {
        var count = await _collection.CountDocumentsAsync(o => o.OrderNumber == orderNumber);
        return count > 0;
    }

    public async Task<long> CountByTypeAsync(string type)
    {
        return await _collection.CountDocumentsAsync(o => o.Type == type);
    }

    public async Task<long> UpdateClientNameByClientIdAsync(string clientId, string newClientName)
    {
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(newClientName))
            return 0;
        var trimmedId = clientId.Trim();
        var trimmedName = newClientName.Trim();
        var filter = Builders<Order>.Filter.Eq(o => o.ClientId, trimmedId);
        var update = Builders<Order>.Update
            .Set(o => o.ClientName, trimmedName)
            .Set(o => o.UpdatedAt, DateTime.UtcNow);
        var result = await _collection.UpdateManyAsync(filter, update);
        return result.ModifiedCount;
    }

    public async Task<int> GetMaxNumericSuffixForTypeAndPrefixAsync(string orderType, string prefix)
    {
        if (string.IsNullOrEmpty(orderType) || string.IsNullOrEmpty(prefix))
            return 0;

        var pattern = $"^{Regex.Escape(prefix)}\\d+$";
        var matchFilter = Builders<Order>.Filter.And(
            Builders<Order>.Filter.Eq(o => o.Type, orderType),
            Builders<Order>.Filter.Regex(o => o.OrderNumber, new BsonRegularExpression(pattern, "i")));

        var addFields = new BsonDocument("$addFields", new BsonDocument("num",
            new BsonDocument("$toInt",
                new BsonDocument("$arrayElemAt", new BsonArray
                {
                    new BsonDocument("$split", new BsonArray { "$orderNumber", "-" }),
                    -1
                }))));

        var group = new BsonDocument("$group", new BsonDocument
        {
            ["_id"] = BsonNull.Value,
            ["maxNum"] = new BsonDocument("$max", "$num")
        });

        var doc = await _collection.Aggregate()
            .Match(matchFilter)
            .AppendStage<BsonDocument>(addFields)
            .AppendStage<BsonDocument>(group)
            .FirstOrDefaultAsync();

        if (doc == null || !doc.TryGetValue("maxNum", out var maxVal) || maxVal.IsBsonNull)
            return 0;

        return maxVal.ToInt32();
    }

    public async Task<DashboardMetricsRawData> GetDashboardMetricsRawDataAsync(
        DateTime periodStart,
        DateTime periodEnd,
        DateTime prevPeriodStart,
        DateTime prevPeriodEnd,
        IReadOnlyCollection<string>? onlineSellerTeamIds = null,
        CancellationToken cancellationToken = default)
    {
        var raw = new DashboardMetricsRawData();

        // 1. Obtener tasa activa del día
        var activeRateDoc = await _context.ExchangeRates
            .Find(r => r.ToCurrency == "USD" && r.IsActive)
            .SortByDescending(r => r.EffectiveDate)
            .FirstOrDefaultAsync(cancellationToken);
        if (activeRateDoc == null)
        {
            activeRateDoc = await _context.ExchangeRates
                .Find(r => r.ToCurrency == "USD")
                .SortByDescending(r => r.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);
        }
        decimal liveUsdRate = activeRateDoc?.Rate > 0 ? activeRateDoc.Rate : 1.0m;

        var fb = Builders<Order>.Filter;

        // Filtro base para pedidos válidos (no presupuestos, no reservas, no cancelados)
        var validOrdersBase = fb.And(
            fb.Nin(o => o.Type, new[] { "Budget", "Reservation", "PendingConfirmation", "budget", "reservation" }),
            fb.Nin(o => o.Status, new[] { "Declinado", "Cancelado" }),
            fb.Not(fb.Regex(o => o.OrderNumber, new BsonRegularExpression("^RES-"))),
            fb.Not(fb.Regex(o => o.OrderNumber, new BsonRegularExpression("^PCF-")))
        );

        // Periodo actual: Ventas y Facturado
        var currentVentasFilter = CombineFilters(
            fb.And(validOrdersBase, fb.Gte(o => o.CreatedAt, periodStart), fb.Lte(o => o.CreatedAt, periodEnd)),
            onlineSellerTeamIds);

        var currentVentas = await _collection.Find(currentVentasFilter)
            .Project(o => new { o.Total })
            .ToListAsync(cancellationToken);

        raw.CurrentOrdersCount = currentVentas.Count;
        raw.CurrentInvoicedUsd = currentVentas.Sum(o => o.Total);

        // Periodo previo: Ventas y Facturado
        var prevVentasFilter = CombineFilters(
            fb.And(validOrdersBase, fb.Gte(o => o.CreatedAt, prevPeriodStart), fb.Lte(o => o.CreatedAt, prevPeriodEnd)),
            onlineSellerTeamIds);

        var prevVentas = await _collection.Find(prevVentasFilter)
            .Project(o => new { o.Total })
            .ToListAsync(cancellationToken);

        raw.PreviousOrdersCount = prevVentas.Count;
        raw.PreviousInvoicedUsd = prevVentas.Sum(o => o.Total);

        // Helper para convertir pago a USD
        decimal ConvertPaymentToUsd(PartialPayment p, Order o)
        {
            var det = p.PaymentDetails;
            var currency = (det?.OriginalCurrency ?? det?.CashCurrency ?? "Bs").Trim();
            var amount = det?.OriginalAmount ?? p.Amount;
            if (string.Equals(currency, "USD", StringComparison.OrdinalIgnoreCase))
                return amount;

            var rate = (det?.ExchangeRate > 0 ? det.ExchangeRate.Value : 0m);
            if (rate <= 0 && o.ExchangeRatesAtCreation?.Usd?.Rate > 0)
                rate = o.ExchangeRatesAtCreation.Usd.Rate;
            if (rate <= 0 && o.PaymentDetails?.ExchangeRate > 0)
                rate = o.PaymentDetails.ExchangeRate.Value;
            if (rate <= 0)
                rate = liveUsdRate;

            if (rate > 0)
                return amount / rate;
            return 0m;
        }

        // Cobros en periodo actual
        var paymentsCurrentFilter = CombineFilters(
            fb.And(
                fb.Nin(o => o.Status, new[] { "Declinado", "Cancelado" }),
                fb.Or(
                    fb.ElemMatch(o => o.PartialPayments, p => p.Date >= periodStart && p.Date <= periodEnd),
                    fb.ElemMatch(o => o.MixedPayments, p => p.Date >= periodStart && p.Date <= periodEnd)
                )
            ),
            onlineSellerTeamIds);

        var ordersWithCurrentPayments = await _collection.Find(paymentsCurrentFilter)
            .ToListAsync(cancellationToken);

        foreach (var order in ordersWithCurrentPayments)
        {
            var allPayments = (order.PartialPayments ?? Enumerable.Empty<PartialPayment>())
                .Concat(order.MixedPayments ?? Enumerable.Empty<PartialPayment>());
            foreach (var p in allPayments)
            {
                if (p.Date >= periodStart && p.Date <= periodEnd)
                {
                    raw.CurrentCollectedUsd += ConvertPaymentToUsd(p, order);
                }
            }
        }

        // Cobros en periodo previo
        var paymentsPrevFilter = CombineFilters(
            fb.And(
                fb.Nin(o => o.Status, new[] { "Declinado", "Cancelado" }),
                fb.Or(
                    fb.ElemMatch(o => o.PartialPayments, p => p.Date >= prevPeriodStart && p.Date <= prevPeriodEnd),
                    fb.ElemMatch(o => o.MixedPayments, p => p.Date >= prevPeriodStart && p.Date <= prevPeriodEnd)
                )
            ),
            onlineSellerTeamIds);

        var ordersWithPrevPayments = await _collection.Find(paymentsPrevFilter)
            .ToListAsync(cancellationToken);

        foreach (var order in ordersWithPrevPayments)
        {
            var allPayments = (order.PartialPayments ?? Enumerable.Empty<PartialPayment>())
                .Concat(order.MixedPayments ?? Enumerable.Empty<PartialPayment>());
            foreach (var p in allPayments)
            {
                if (p.Date >= prevPeriodStart && p.Date <= prevPeriodEnd)
                {
                    raw.PreviousCollectedUsd += ConvertPaymentToUsd(p, order);
                }
            }
        }

        // Abonos por recaudar (pedidos activos no cancelados ni completados con saldo)
        var activePendingFilter = CombineFilters(
            fb.And(
                fb.Nin(o => o.Type, new[] { "Budget", "Reservation", "PendingConfirmation", "budget", "reservation" }),
                fb.Nin(o => o.Status, new[] { "Declinado", "Cancelado", "Entregado", "Completado", "Completada" })
            ),
            onlineSellerTeamIds);

        var activeOrders = await _collection.Find(activePendingFilter)
            .ToListAsync(cancellationToken);

        foreach (var order in activeOrders)
        {
            var allPayments = (order.PartialPayments ?? Enumerable.Empty<PartialPayment>())
                .Concat(order.MixedPayments ?? Enumerable.Empty<PartialPayment>());
            decimal paidUsd = allPayments.Sum(p => ConvertPaymentToUsd(p, order));
            decimal pending = order.Total - paidUsd;
            if (pending > 0.01m)
            {
                raw.PendingPaymentsUsd += pending;
            }
        }

        // SA Vencidos (> 90 días)
        var ninetyDaysAgo = DateTime.UtcNow.AddDays(-90);
        var saVencidosFilter = CombineFilters(
            fb.And(
                fb.Eq(o => o.SaleType, "sistema_apartado"),
                fb.Lt(o => o.CreatedAt, ninetyDaysAgo),
                fb.Nin(o => o.Status, new[] { "Declinado", "Cancelado", "Entregado", "Completado", "Completada" })
            ),
            onlineSellerTeamIds);

        var saOrders = await _collection.Find(saVencidosFilter)
            .ToListAsync(cancellationToken);

        foreach (var order in saOrders)
        {
            var allPayments = (order.PartialPayments ?? Enumerable.Empty<PartialPayment>())
                .Concat(order.MixedPayments ?? Enumerable.Empty<PartialPayment>());
            decimal paidUsd = allPayments.Sum(p => ConvertPaymentToUsd(p, order));
            decimal pending = order.Total - paidUsd;
            if (pending > 0.01m)
            {
                raw.ExpiredLayawaysCount++;
                raw.ExpiredLayawaysAmountUsd += pending;
            }
        }

        // Productos por fabricar
        var mfgFilter = CombineFilters(
            fb.And(
                fb.Nin(o => o.Type, new[] { "Budget", "Reservation", "PendingConfirmation", "budget", "reservation" }),
                fb.Nin(o => o.Status, new[] { "Declinado", "Cancelado" }),
                fb.ElemMatch(o => o.Products, p =>
                    p.LocationStatus == "FABRICACION" ||
                    p.ManufacturingStatus == "por_fabricar" ||
                    p.ManufacturingStatus == "debe_fabricar")
            ),
            onlineSellerTeamIds);

        var mfgOrders = await _collection.Find(mfgFilter)
            .ToListAsync(cancellationToken);

        foreach (var order in mfgOrders)
        {
            foreach (var prod in order.Products ?? Enumerable.Empty<OrderProduct>())
            {
                if (prod.LocationStatus == "FABRICACION" ||
                    prod.ManufacturingStatus == "por_fabricar" ||
                    prod.ManufacturingStatus == "debe_fabricar")
                {
                    raw.ProductsToManufactureCount += prod.Quantity > 0 ? prod.Quantity : 1;
                }
            }
        }

        return raw;
    }
}
