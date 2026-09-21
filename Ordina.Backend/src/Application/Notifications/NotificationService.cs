using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Threading.Channels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Ordina.Domain.Notifications;

namespace Ordina.Application.Notifications;

public class NotificationService : INotificationService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<NotificationService> _logger;

    private record ClientSubscription(
        string ConnectionId,
        string UserId,
        List<string> Roles,
        Channel<NotificationDto> Channel);

    private readonly ConcurrentDictionary<string, ClientSubscription> _subscriptions = new();

    public NotificationService(
        IServiceScopeFactory scopeFactory,
        ILogger<NotificationService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task<NotificationDto> PublishAsync(CreateNotificationDto dto, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<INotificationRepository>();

        var entity = new Notification
        {
            Type = dto.Type,
            Title = dto.Title,
            Message = dto.Message,
            Severity = dto.Severity,
            Link = dto.Link,
            TargetUserId = dto.TargetUserId,
            TargetRoles = dto.TargetRoles ?? new(),
            Metadata = dto.Metadata,
            CreatedAt = DateTime.UtcNow
        };

        await repo.CreateAsync(entity, ct);

        var notificationDto = MapToDto(entity, false);

        // Broadcast to matching connected SSE clients
        foreach (var sub in _subscriptions.Values)
        {
            if (MatchesAudience(sub.UserId, sub.Roles, entity))
            {
                sub.Channel.Writer.TryWrite(notificationDto);
            }
        }

        _logger.LogInformation("Notification published: {Type} - {Title} to {SubscriberCount} subscribers",
            entity.Type, entity.Title, _subscriptions.Count);

        return notificationDto;
    }

    private static bool MatchesAudience(string userId, IEnumerable<string> userRoles, Notification n)
    {
        if (!string.IsNullOrEmpty(n.TargetUserId))
        {
            return n.TargetUserId == userId;
        }

        if (n.TargetRoles == null || n.TargetRoles.Count == 0)
        {
            return true;
        }

        return userRoles.Any(r => n.TargetRoles.Contains(r, StringComparer.OrdinalIgnoreCase));
    }

    public async IAsyncEnumerable<NotificationDto> SubscribeAsync(
        string userId,
        IEnumerable<string> roles,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var connectionId = Guid.NewGuid().ToString();
        var channel = Channel.CreateUnbounded<NotificationDto>(new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false
        });

        var subscription = new ClientSubscription(connectionId, userId, roles.ToList(), channel);
        _subscriptions.TryAdd(connectionId, subscription);

        try
        {
            while (!ct.IsCancellationRequested && await channel.Reader.WaitToReadAsync(ct))
            {
                while (channel.Reader.TryRead(out var item))
                {
                    yield return item;
                }
            }
        }
        finally
        {
            _subscriptions.TryRemove(connectionId, out _);
        }
    }

    public async Task<IReadOnlyList<NotificationDto>> GetUserNotificationsAsync(
        string userId,
        IEnumerable<string> roles,
        int skip = 0,
        int limit = 10,
        CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<INotificationRepository>();

        var entities = await repo.GetForUserAsync(userId, roles, skip, limit, ct);
        return entities.Select(e => MapToDto(e, e.ReadByUserIds.Contains(userId))).ToList();
    }

    public async Task<long> GetUnreadCountAsync(
        string userId,
        IEnumerable<string> roles,
        CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<INotificationRepository>();

        return await repo.GetUnreadCountAsync(userId, roles, ct);
    }

    public async Task<bool> MarkAsReadAsync(string notificationId, string userId, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<INotificationRepository>();

        return await repo.MarkAsReadAsync(notificationId, userId, ct);
    }

    public async Task<bool> MarkAllAsReadAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<INotificationRepository>();

        return await repo.MarkAllAsReadAsync(userId, roles, ct);
    }

    public async Task<bool> DeleteAsync(string notificationId, string userId, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<INotificationRepository>();

        return await repo.DeleteAsync(notificationId, userId, ct);
    }

    public async Task<bool> DeleteAllAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<INotificationRepository>();

        return await repo.DeleteAllAsync(userId, roles, ct);
    }

    private static NotificationDto MapToDto(Notification n, bool isRead) =>
        new(
            n.Id,
            n.Type,
            n.Title,
            n.Message,
            n.Severity,
            n.Link,
            n.TargetUserId,
            n.TargetRoles,
            isRead,
            n.CreatedAt,
            n.Metadata);
}
