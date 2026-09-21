namespace Ordina.Application.Notifications;

public interface INotificationService
{
    Task<NotificationDto> PublishAsync(CreateNotificationDto dto, CancellationToken ct = default);
    IAsyncEnumerable<NotificationDto> SubscribeAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default);
    Task<IReadOnlyList<NotificationDto>> GetUserNotificationsAsync(string userId, IEnumerable<string> roles, int skip = 0, int limit = 10, CancellationToken ct = default);
    Task<long> GetUnreadCountAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default);
    Task<bool> MarkAsReadAsync(string notificationId, string userId, CancellationToken ct = default);
    Task<bool> MarkAllAsReadAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default);
    Task<bool> DeleteAsync(string notificationId, string userId, CancellationToken ct = default);
    Task<bool> DeleteAllAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default);
}
