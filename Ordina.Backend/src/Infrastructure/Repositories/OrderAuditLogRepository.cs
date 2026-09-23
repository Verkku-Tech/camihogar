using MongoDB.Driver;
using Ordina.Application.Common;
using Ordina.Domain.Orders;
using Ordina.Infrastructure.Mongo;

namespace Ordina.Infrastructure.Repositories;

public class OrderAuditLogRepository(MongoDbContext context)
    : MongoRepository<OrderAuditLog>(context.Database, "orderAuditLogs"), IOrderAuditLogRepository
{
    public async Task<PagedResult<OrderAuditLog>> GetPagedLogsAsync(
        int page,
        int pageSize,
        string? userId = null,
        string? orderNumber = null,
        string? action = null,
        DateTime? fromUtc = null,
        DateTime? toUtc = null,
        bool sortAscending = false,
        CancellationToken cancellationToken = default)
    {
        var fb = Builders<OrderAuditLog>.Filter;
        var filter = fb.Empty;

        if (!string.IsNullOrWhiteSpace(userId))
        {
            filter &= fb.Eq(x => x.UserId, userId.Trim());
        }

        if (!string.IsNullOrWhiteSpace(orderNumber))
        {
            filter &= fb.Eq(x => x.OrderNumber, orderNumber.Trim());
        }

        if (!string.IsNullOrWhiteSpace(action))
        {
            filter &= fb.Eq(x => x.Action, action.Trim());
        }

        if (fromUtc.HasValue)
        {
            filter &= fb.Gte(x => x.Timestamp, fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            filter &= fb.Lte(x => x.Timestamp, toUtc.Value);
        }

        var totalCount = await _collection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);

        var sort = sortAscending
            ? Builders<OrderAuditLog>.Sort.Ascending(x => x.Timestamp)
            : Builders<OrderAuditLog>.Sort.Descending(x => x.Timestamp);

        var safePage = Math.Max(1, page);
        var safePageSize = Math.Clamp(pageSize, 1, 100);

        var items = await _collection.Find(filter)
            .Sort(sort)
            .Skip((safePage - 1) * safePageSize)
            .Limit(safePageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<OrderAuditLog>(items, (int)totalCount, safePage, safePageSize);
    }
}
