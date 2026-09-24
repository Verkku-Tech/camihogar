using Ordina.Application.Common;
using Ordina.Domain.Common;
using Ordina.Domain.Notifications;

namespace Ordina.Application.Notifications;

public class NotificationRuleSettingsService : INotificationRuleSettingsService
{
    private readonly IRepository<NotificationRuleSettings> _repo;

    public NotificationRuleSettingsService(IRepository<NotificationRuleSettings> repo)
    {
        _repo = repo;
    }

    public async Task<NotificationRuleSettings> GetSettingsAsync(CancellationToken ct = default)
    {
        var existing = await _repo.GetByIdAsync(NotificationRuleSettings.DefaultId, ct);
        if (existing != null) return existing;

        var defaults = new NotificationRuleSettings();
        return await _repo.AddAsync(defaults, ct);
    }

    public async Task<NotificationRuleSettings> UpdateSettingsAsync(NotificationRuleSettings settings, CancellationToken ct = default)
    {
        settings.Id = NotificationRuleSettings.DefaultId;
        settings.UpdatedAt = DateTime.UtcNow;

        var existing = await _repo.GetByIdAsync(NotificationRuleSettings.DefaultId, ct);
        if (existing == null)
        {
            return await _repo.AddAsync(settings, ct);
        }

        await _repo.UpdateAsync(settings, ct);
        return settings;
    }
}
