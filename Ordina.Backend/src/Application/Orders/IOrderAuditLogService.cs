using Ordina.Domain.Orders;

namespace Ordina.Application.Orders;

public interface IOrderAuditLogService
{
    Task LogOrderCreatedAsync(Order order, string userId, string userName, CancellationToken cancellationToken = default);

    Task LogOrderUpdatedAsync(Order oldOrder, Order newOrder, string userId, string userName, CancellationToken cancellationToken = default);

    Task LogOrderDeletedAsync(Order order, string userId, string userName, CancellationToken cancellationToken = default);

    Task LogItemValidatedAsync(
        Order order,
        string itemId,
        string userId,
        string userName,
        string? previousLogisticStatus = null,
        CancellationToken cancellationToken = default);

    Task LogOrderDeclinedAsync(Order order, string userId, string userName, string? declineReason, CancellationToken cancellationToken = default);

    Task LogOrderDeclineRevertedAsync(Order order, string userId, string userName, CancellationToken cancellationToken = default);

    Task LogPaymentsConciliatedAsync(
        Order orderBefore,
        Order orderAfter,
        IReadOnlyList<ConciliatePaymentRequestDto> requests,
        string userId,
        string userName,
        CancellationToken cancellationToken = default);

    Task<PagedAuditLogsResponseDto> GetPagedLogsAsync(
        int page,
        int pageSize,
        string? userId,
        string? orderNumber,
        string? action,
        DateTime? fromUtc,
        DateTime? toUtc,
        bool sortAscending = false,
        CancellationToken cancellationToken = default);
}
