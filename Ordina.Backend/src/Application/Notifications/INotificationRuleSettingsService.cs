using Ordina.Domain.Notifications;

namespace Ordina.Application.Notifications;

public interface INotificationRuleSettingsService
{
    Task<NotificationRuleSettings> GetSettingsAsync(CancellationToken ct = default);
    Task<NotificationRuleSettings> UpdateSettingsAsync(NotificationRuleSettings settings, CancellationToken ct = default);
}
