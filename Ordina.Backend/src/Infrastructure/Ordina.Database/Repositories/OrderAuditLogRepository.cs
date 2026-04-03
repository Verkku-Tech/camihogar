using MongoDB.Driver;
using Ordina.Database.Entities.Audit;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class OrderAuditLogRepository : IOrderAuditLogRepository
{
    private readonly IMongoCollection<OrderAuditLog> _collection;

    public OrderAuditLogRepository(MongoDbContext context)
    {
        _collection = context.OrderAuditLogs;
    }

    public async Task<OrderAuditLog> CreateAsync(OrderAuditLog log)
    {
        await _collection.InsertOneAsync(log);
        return log;
    }

    public async Task<(IReadOnlyList<OrderAuditLog> Items, long TotalCount)> GetPagedAsync(
        int page,
        int pageSize,
        string? userId,
        string? orderNumber,
        string? action,
        DateTime? fromUtc,
        DateTime? toUtc)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var filter = Builders<OrderAuditLog>.Filter.Empty;

        if (!string.IsNullOrWhiteSpace(userId))
        {
            filter &= Builders<OrderAuditLog>.Filter.Eq(x => x.UserId, userId);
        }

        if (!string.IsNullOrWhiteSpace(orderNumber))
        {
            filter &= Builders<OrderAuditLog>.Filter.Eq(x => x.OrderNumber, orderNumber.Trim());
        }

        if (!string.IsNullOrWhiteSpace(action))
        {
            filter &= Builders<OrderAuditLog>.Filter.Eq(x => x.Action, action.Trim());
        }

        if (fromUtc.HasValue)
        {
            filter &= Builders<OrderAuditLog>.Filter.Gte(x => x.Timestamp, fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            filter &= Builders<OrderAuditLog>.Filter.Lte(x => x.Timestamp, toUtc.Value);
        }

        var totalCount = await _collection.CountDocumentsAsync(filter);

        var items = await _collection
            .Find(filter)
            .SortByDescending(x => x.Timestamp)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }
}
