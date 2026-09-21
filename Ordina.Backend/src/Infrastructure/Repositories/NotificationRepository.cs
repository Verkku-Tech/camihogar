using MongoDB.Driver;
using Ordina.Domain.Notifications;
using Ordina.Infrastructure.Mongo;

namespace Ordina.Infrastructure.Repositories;

public class NotificationRepository : MongoRepository<Notification>, INotificationRepository
{
    public NotificationRepository(MongoDbContext context) : base(context.Database, "notifications")
    {
    }

    public async Task<Notification> CreateAsync(Notification notification, CancellationToken ct = default)
    {
        return await AddAsync(notification, ct);
    }

    private static FilterDefinition<Notification> BuildAudienceFilter(string userId, IEnumerable<string> roles)
    {
        var roleList = roles.ToList();
        var fb = Builders<Notification>.Filter;

        var userSpecificFilter = fb.Eq(n => n.TargetUserId, userId);
        var broadcastFilter = fb.Size(n => n.TargetRoles, 0) & fb.Eq(n => n.TargetUserId, null);
        var roleMatchFilter = fb.AnyIn(n => n.TargetRoles, roleList);

        return fb.Or(userSpecificFilter, broadcastFilter, roleMatchFilter);
    }

    public async Task<IReadOnlyList<Notification>> GetForUserAsync(string userId, IEnumerable<string> roles, int limit = 50, CancellationToken ct = default)
    {
        var filter = BuildAudienceFilter(userId, roles);
        return await _collection.Find(filter)
            .SortByDescending(n => n.CreatedAt)
            .Limit(limit)
            .ToListAsync(ct);
    }

    public async Task<long> GetUnreadCountAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default)
    {
        var fb = Builders<Notification>.Filter;
        var audienceFilter = BuildAudienceFilter(userId, roles);
        var unreadFilter = fb.Not(fb.AnyEq(n => n.ReadByUserIds, userId));

        return await _collection.CountDocumentsAsync(audienceFilter & unreadFilter, cancellationToken: ct);
    }

    public async Task<bool> MarkAsReadAsync(string notificationId, string userId, CancellationToken ct = default)
    {
        var fb = Builders<Notification>.Filter;
        var ub = Builders<Notification>.Update;

        var filter = fb.Eq(n => n.Id, notificationId);
        var update = ub.AddToSet(n => n.ReadByUserIds, userId);

        var result = await _collection.UpdateOneAsync(filter, update, cancellationToken: ct);
        return result.ModifiedCount > 0;
    }

    public async Task<bool> MarkAllAsReadAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default)
    {
        var audienceFilter = BuildAudienceFilter(userId, roles);
        var fb = Builders<Notification>.Filter;
        var unreadFilter = fb.Not(fb.AnyEq(n => n.ReadByUserIds, userId));

        var ub = Builders<Notification>.Update;
        var update = ub.AddToSet(n => n.ReadByUserIds, userId);

        var result = await _collection.UpdateManyAsync(audienceFilter & unreadFilter, update, cancellationToken: ct);
        return result.ModifiedCount > 0;
    }

    public async Task<Notification?> GetActiveConsolidatedAsync(string type, string? targetUserId = null, CancellationToken ct = default)
    {
        var fb = Builders<Notification>.Filter;
        var filter = fb.Eq(n => n.Type, type);

        if (!string.IsNullOrEmpty(targetUserId))
        {
            filter &= fb.Eq(n => n.TargetUserId, targetUserId);
        }

        return await _collection.Find(filter)
            .SortByDescending(n => n.CreatedAt)
            .FirstOrDefaultAsync(ct);
    }
}
