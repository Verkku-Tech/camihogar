using Ordina.Database.Entities.Audit;

namespace Ordina.Database.Repositories;

public interface IOrderAuditLogRepository
{
    Task<OrderAuditLog> CreateAsync(OrderAuditLog log);

    Task<(IReadOnlyList<OrderAuditLog> Items, long TotalCount)> GetPagedAsync(
        int page,
        int pageSize,
        string? userId,
        string? orderNumber,
        string? action,
        DateTime? fromUtc,
        DateTime? toUtc);
}
