using Ordina.Domain.Analytics;

namespace Ordina.Application.Analytics;

public interface IOperationsMetricsSettingsService
{
    Task<OperationsMetricsSettings> GetSettingsAsync(CancellationToken ct = default);
    Task<OperationsMetricsSettings> UpdateSettingsAsync(OperationsMetricsSettings settings, CancellationToken ct = default);
}
