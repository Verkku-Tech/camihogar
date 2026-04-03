using Ordina.Database.Entities.Order;
using Ordina.Orders.Application.DTOs;

namespace Ordina.Orders.Application.Services;

public interface IOrderAuditLogService
{
    Task LogOrderCreatedAsync(Order order, string userId, string userName);

    Task LogOrderUpdatedAsync(Order oldOrder, Order newOrder, string userId, string userName);

    Task LogOrderDeletedAsync(Order order, string userId, string userName);

    Task LogItemValidatedAsync(Order order, string itemId, string userId, string userName);

    Task LogPaymentsConciliatedAsync(
        Order orderBefore,
        Order orderAfter,
        IReadOnlyList<ConciliatePaymentRequestDto> requests,
        string userId,
        string userName);

    Task<PagedAuditLogsResponseDto> GetPagedLogsAsync(
        int page,
        int pageSize,
        string? userId,
        string? orderNumber,
        string? action,
        DateTime? fromUtc,
        DateTime? toUtc);
}
