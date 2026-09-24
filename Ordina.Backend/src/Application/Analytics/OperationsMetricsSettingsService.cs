using Ordina.Application.Common;
using Ordina.Domain.Analytics;
using Ordina.Domain.Common;

namespace Ordina.Application.Analytics;

public class OperationsMetricsSettingsService : IOperationsMetricsSettingsService
{
    private readonly IRepository<OperationsMetricsSettings> _repo;

    public OperationsMetricsSettingsService(IRepository<OperationsMetricsSettings> repo)
    {
        _repo = repo;
    }

    public async Task<OperationsMetricsSettings> GetSettingsAsync(CancellationToken ct = default)
    {
        var all = await _repo.GetAllAsync(ct);
        var existing = all.FirstOrDefault();
        if (existing != null) return existing;

        var defaults = new OperationsMetricsSettings();
        return await _repo.AddAsync(defaults, ct);
    }

    public async Task<OperationsMetricsSettings> UpdateSettingsAsync(OperationsMetricsSettings settings, CancellationToken ct = default)
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
