using MongoDB.Driver;
using Ordina.Application.Common;
using Ordina.Domain.Dashboard;
using Ordina.Infrastructure.Mongo;

namespace Ordina.Infrastructure.Repositories;

public class SalesForecastRepository(MongoDbContext context) : ISalesForecastRepository
{
    public async Task<SalesForecastRecord?> GetLatestAsync(
        string period,
        int weekOffset,
        DateTime startDate,
        DateTime endDate,
        CancellationToken ct = default)
    {
        return await context.SalesProjections
            .Find(x => x.Period == period && x.WeekOffset == weekOffset && x.StartDate == startDate && x.EndDate == endDate)
            .SortByDescending(x => x.VersionNumber)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<int> GetMaxVersionNumberAsync(CancellationToken ct = default)
    {
        var latest = await context.SalesProjections
            .Find(_ => true)
            .SortByDescending(x => x.VersionNumber)
            .Limit(1)
            .FirstOrDefaultAsync(ct);

        return latest?.VersionNumber ?? 0;
    }

    public async Task<SalesForecastRecord> InsertAsync(SalesForecastRecord record, CancellationToken ct = default)
    {
        record.CreatedAt = DateTime.UtcNow;
        record.UpdatedAt = DateTime.UtcNow;
        await context.SalesProjections.InsertOneAsync(record, cancellationToken: ct);
        return record;
    }

    public async Task<SalesForecastRecord> UpdateAsync(SalesForecastRecord record, CancellationToken ct = default)
    {
        record.UpdatedAt = DateTime.UtcNow;
        await context.SalesProjections.ReplaceOneAsync(x => x.Id == record.Id, record, cancellationToken: ct);
        return record;
    }

    public async Task<IReadOnlyList<SalesForecastRecord>> GetHistoryAsync(string? period = null, CancellationToken ct = default)
    {
        var filter = string.IsNullOrWhiteSpace(period)
            ? Builders<SalesForecastRecord>.Filter.Empty
            : Builders<SalesForecastRecord>.Filter.Eq(x => x.Period, period);

        return await context.SalesProjections
            .Find(filter)
            .SortByDescending(x => x.CreatedAt)
            .Limit(100)
            .ToListAsync(ct);
    }

    public async Task<SalesForecastRecord?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        return await context.SalesProjections.Find(x => x.Id == id).FirstOrDefaultAsync(ct);
    }
}
