namespace Ordina.Domain.Notifications;

public interface INotificationRepository
{
    Task<Notification> CreateAsync(Notification notification, CancellationToken ct = default);
    Task<IReadOnlyList<Notification>> GetForUserAsync(string userId, IEnumerable<string> roles, int limit = 50, CancellationToken ct = default);
    Task<long> GetUnreadCountAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default);
    Task<bool> MarkAsReadAsync(string notificationId, string userId, CancellationToken ct = default);
    Task<bool> MarkAllAsReadAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default);
    Task<Notification?> GetActiveConsolidatedAsync(string type, string? targetUserId = null, CancellationToken ct = default);
    Task<bool> UpdateAsync(Notification notification, CancellationToken ct = default);
}
