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
        var existing = await _repo.GetByIdAsync(OperationsMetricsSettings.DefaultId, ct);
        if (existing != null) return existing;

        var defaults = new OperationsMetricsSettings();
        return await _repo.AddAsync(defaults, ct);
    }

    public async Task<OperationsMetricsSettings> UpdateSettingsAsync(OperationsMetricsSettings settings, CancellationToken ct = default)
    {
        settings.Id = OperationsMetricsSettings.DefaultId;
        settings.UpdatedAt = DateTime.UtcNow;

        var existing = await _repo.GetByIdAsync(OperationsMetricsSettings.DefaultId, ct);
        if (existing == null)
        {
            return await _repo.AddAsync(settings, ct);
        }

        await _repo.UpdateAsync(settings, ct);
        return settings;
    }
}
