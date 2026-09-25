using Ordina.Domain.Dashboard;

namespace Ordina.Application.Common;

public interface ISalesForecastRepository
{
    Task<SalesForecastRecord?> GetLatestAsync(string period, int weekOffset, DateTime startDate, DateTime endDate, CancellationToken ct = default);
    Task<int> GetMaxVersionNumberAsync(CancellationToken ct = default);
    Task<SalesForecastRecord> InsertAsync(SalesForecastRecord record, CancellationToken ct = default);
    Task<SalesForecastRecord> UpdateAsync(SalesForecastRecord record, CancellationToken ct = default);
    Task<IReadOnlyList<SalesForecastRecord>> GetHistoryAsync(string? period = null, CancellationToken ct = default);
    Task<SalesForecastRecord?> GetByIdAsync(string id, CancellationToken ct = default);
}
