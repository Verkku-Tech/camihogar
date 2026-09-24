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
        var all = await _repo.GetAllAsync(ct);
        var existing = all.FirstOrDefault();
        if (existing != null) return existing;

        var defaults = new NotificationRuleSettings();
        return await _repo.AddAsync(defaults, ct);
    }

    public async Task<NotificationRuleSettings> UpdateSettingsAsync(NotificationRuleSettings settings, CancellationToken ct = default)
    {
        var all = await _repo.GetAllAsync(ct);
        var existing = all.FirstOrDefault();
        if (existing == null)
        {
            settings.Id = string.Empty;
            return await _repo.AddAsync(settings, ct);
        }

        settings.Id = existing.Id;
        settings.UpdatedAt = DateTime.UtcNow;
        await _repo.UpdateAsync(settings, ct);
        return settings;
    }
}
