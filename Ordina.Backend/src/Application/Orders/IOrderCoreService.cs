using Ordina.Application.Common;

namespace Ordina.Application.Orders;

public interface IOrderCoreService
{
    Task<OrderResponseDto?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<OrderResponseDto?> GetByOrderNumberAsync(string orderNumber, CancellationToken cancellationToken = default);
    Task<PagedResult<OrderResponseDto>> GetPagedAsync(PagedRequest request, OrderQueryFilter? filter = null, CancellationToken cancellationToken = default);
    Task<PagedResult<OrderResponseDto>> GetPagedAsync(PagedRequest request, string? type, string? status, CancellationToken cancellationToken = default);
    Task<OrderResponseDto> CreateOrderAsync(CreateOrderDto createDto, CancellationToken cancellationToken = default);
    Task<OrderResponseDto> UpdateOrderAsync(string id, UpdateOrderDto updateDto, DateTime? expectedUpdatedAt = null, CancellationToken cancellationToken = default);
    Task<OrderResponseDto> ConvertBudgetToOrderAsync(ConvertBudgetDto convertDto, CancellationToken cancellationToken = default);
    Task<bool> CancelOrderAsync(string id, string reason, CancellationToken cancellationToken = default);
}
