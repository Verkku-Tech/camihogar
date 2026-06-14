using System.Text.RegularExpressions;
using MongoDB.Bson;
using MongoDB.Driver;
using Ordina.Database.Entities.Order;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class OrderRepository : IOrderRepository
{
    private readonly IMongoCollection<Order> _collection;

    public OrderRepository(MongoDbContext context)
    {
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
        IReadOnlyCollection<string>? onlineSellerTeamIds = null)
    {
        var filterBuilder = Builders<Order>.Filter;
        var filter = filterBuilder.Empty;

        if (since.HasValue)
            filter = filterBuilder.Gte(o => o.UpdatedAt, since.Value);

        filter = CombineFilters(filter, onlineSellerTeamIds);

        var totalCount = await _collection.CountDocumentsAsync(filter);
        var skip = (page - 1) * pageSize;

        var orders = await _collection.Find(filter)
            .SortByDescending(o => o.UpdatedAt)
            .Skip(skip)
            .Limit(pageSize)
            .ToListAsync();

        return (orders, (int)totalCount);
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
}
