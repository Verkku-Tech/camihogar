using Ordina.Orders.Application.DTOs;

namespace Ordina.Orders.Application.Services;

public interface IOrderService
{
    Task<IEnumerable<OrderResponseDto>> GetAllOrdersAsync();
    
    /// <summary>
    /// Obtiene pedidos con paginación y filtro de sincronización incremental
    /// </summary>
    /// <param name="page">Número de página (1-indexed)</param>
    /// <param name="pageSize">Cantidad de elementos por página</param>
    /// <param name="since">Fecha opcional para obtener solo pedidos modificados desde esa fecha (sincronización incremental)</param>
    /// <returns>Respuesta paginada con los pedidos</returns>
    Task<PagedOrdersResponseDto> GetOrdersPagedAsync(int page = 1, int pageSize = 50, DateTime? since = null);
    
    Task<IEnumerable<OrderResponseDto>> GetOrdersByClientIdAsync(string clientId);
    Task<IEnumerable<OrderResponseDto>> GetOrdersByStatusAsync(string status);
    Task<OrderResponseDto?> GetOrderByIdAsync(string id);
    Task<OrderResponseDto?> GetOrderByOrderNumberAsync(string orderNumber);
    Task<OrderResponseDto> CreateOrderAsync(CreateOrderDto createDto, string userId, string userName);
    Task<OrderResponseDto> ConfirmPendingOrderAsync(string pendingOrderId, ConfirmOrderDto confirmDto, string userId, string userName);
    Task<OrderResponseDto> ConvertBudgetToOrderAsync(string budgetId, ConvertBudgetToOrderDto dto, string userId, string userName);
    Task<OrderResponseDto> UpdateOrderAsync(string id, UpdateOrderDto updateDto, string userId, string userName);
    Task<OrderResponseDto> ValidateOrderItemAsync(string id, string itemId, string userId, string userName);
    Task<bool> DeleteOrderAsync(string id, string userId, string userName);
    Task<bool> OrderExistsAsync(string id);
    Task<bool> OrderNumberExistsAsync(string orderNumber);
    Task<bool> ConciliatePaymentsAsync(List<ConciliatePaymentRequestDto> requests, string userId, string userName);
}

