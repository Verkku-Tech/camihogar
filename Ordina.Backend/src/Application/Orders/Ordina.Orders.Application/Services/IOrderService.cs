using Ordina.Orders.Application.DTOs;

namespace Ordina.Orders.Application.Services;

public interface IOrderService
{
    Task<IEnumerable<OrderResponseDto>> GetAllOrdersAsync(string? callerRole = null);
    
    /// <summary>
    /// Obtiene pedidos con paginación y filtro de sincronización incremental
    /// </summary>
    Task<PagedOrdersResponseDto> GetOrdersPagedAsync(
        int page = 1,
        int pageSize = 50,
        DateTime? since = null,
        string? callerRole = null,
        OrderListFilterDto? listFilter = null);

    /// <summary>Búsqueda liviana para el combobox del header (número, cliente, teléfono/CI vía clientes).</summary>
    Task<IReadOnlyList<OrderSearchResultDto>> SearchOrdersAsync(
        string query,
        int limit = 20,
        string? callerRole = null);
    
    Task<IEnumerable<OrderResponseDto>> GetOrdersByClientIdAsync(
        string clientId,
        string? callerRole = null);
    Task<IEnumerable<OrderResponseDto>> GetOrdersByStatusAsync(
        string status,
        string? callerRole = null);
    Task<OrderResponseDto?> GetOrderByIdAsync(string id, string? callerRole = null);
    Task<OrderResponseDto?> GetOrderByOrderNumberAsync(string orderNumber, string? callerRole = null);
    Task<OrderResponseDto> CreateOrderAsync(CreateOrderDto createDto, string userId, string userName);
    Task<OrderResponseDto> ConfirmPendingOrderAsync(
        string pendingOrderId,
        ConfirmOrderDto confirmDto,
        string userId,
        string userName,
        string? callerRole = null);
    Task<OrderResponseDto> ConvertBudgetToOrderAsync(string budgetId, ConvertBudgetToOrderDto dto, string userId, string userName);
    Task<OrderResponseDto> UpdateOrderAsync(
        string id,
        UpdateOrderDto updateDto,
        string userId,
        string userName,
        string? callerRole = null,
        bool callerHasDispatchUpdate = false,
        bool callerHasDispatchSendToRoute = false,
        bool callerHasDispatchConfirmDelivery = false,
        bool callerHasManufacturingManage = false,
        bool callerHasInventoryMovementsView = false,
        bool callerHasOrdersUpdate = false);
    Task<OrderResponseDto> ValidateOrderItemAsync(string id, string itemId, string userId, string userName);
    Task<bool> DeleteOrderAsync(
        string id,
        string userId,
        string userName,
        string? callerRole = null);
    Task<bool> OrderExistsAsync(string id);
    Task<bool> OrderNumberExistsAsync(string orderNumber);
    Task<bool> ConciliatePaymentsAsync(List<ConciliatePaymentRequestDto> requests, string userId, string userName);
}
