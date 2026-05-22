using MongoDB.Driver;
using Ordina.Database.Entities.AccessPin;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class AccessPinRepository : IAccessPinRepository
{
    private readonly IMongoCollection<AccessPin> _collection;

    public AccessPinRepository(MongoDbContext context)
    {
        _collection = context.AccessPins;
    }

    public async Task<AccessPin> CreateAsync(AccessPin accessPin)
    {
        await _collection.InsertOneAsync(accessPin);
        return accessPin;
    }

    public async Task<AccessPin?> GetActiveByPinAsync(string pin)
    {
        var now = DateTime.UtcNow;
        return await _collection
            .Find(p => p.Pin == pin && p.Status == AccessPinStatus.Active && p.ExpiresAt > now)
            .FirstOrDefaultAsync();
    }

    public async Task<AccessPin?> GetActiveSessionAsync(string orderId, string userId)
    {
        var now = DateTime.UtcNow;
        return await _collection
            .Find(p =>
                p.OrderId == orderId
                && p.UsedByUserId == userId
                && p.Status == AccessPinStatus.Used
                && p.SessionExpiresAt != null
                && p.SessionExpiresAt > now)
            .SortByDescending(p => p.SessionExpiresAt)
            .FirstOrDefaultAsync();
    }

    public async Task MarkAsUsedAsync(
        string id,
        string usedByUserId,
        string orderId,
        DateTime usedAt,
        DateTime sessionExpiresAt)
    {
        var update = Builders<AccessPin>.Update
            .Set(p => p.Status, AccessPinStatus.Used)
            .Set(p => p.UsedByUserId, usedByUserId)
            .Set(p => p.UsedAt, usedAt)
            .Set(p => p.OrderId, orderId)
            .Set(p => p.SessionExpiresAt, sessionExpiresAt);

        await _collection.UpdateOneAsync(p => p.Id == id, update);
    }

    public async Task ExpireStaleActivePinsAsync(DateTime nowUtc)
    {
        var filter = Builders<AccessPin>.Filter.And(
            Builders<AccessPin>.Filter.Eq(p => p.Status, AccessPinStatus.Active),
            Builders<AccessPin>.Filter.Lte(p => p.ExpiresAt, nowUtc));

        var update = Builders<AccessPin>.Update.Set(p => p.Status, AccessPinStatus.Expired);
        await _collection.UpdateManyAsync(filter, update);
    }

    public async Task<(IReadOnlyList<AccessPin> Items, long TotalCount)> GetPagedHistoryAsync(
        int page,
        int pageSize)
    {
        var safePage = Math.Max(1, page);
        var safeSize = Math.Clamp(pageSize, 1, 100);
        var skip = (safePage - 1) * safeSize;

        var total = await _collection.CountDocumentsAsync(FilterDefinition<AccessPin>.Empty);
        var items = await _collection
            .Find(FilterDefinition<AccessPin>.Empty)
            .SortByDescending(p => p.CreatedAt)
            .Skip(skip)
            .Limit(safeSize)
            .ToListAsync();

        return (items, total);
    }
}
