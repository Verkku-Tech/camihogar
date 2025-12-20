using Ordina.Orders.Application.DTOs;

namespace Ordina.Orders.Application.Services;

public interface IOrderService
{
    Task<IEnumerable<OrderResponseDto>> GetAllOrdersAsync();
    Task<IEnumerable<OrderResponseDto>> GetOrdersByClientIdAsync(string clientId);
    Task<IEnumerable<OrderResponseDto>> GetOrdersByStatusAsync(string status);
    Task<OrderResponseDto?> GetOrderByIdAsync(string id);
    Task<OrderResponseDto?> GetOrderByOrderNumberAsync(string orderNumber);
    Task<OrderResponseDto> CreateOrderAsync(CreateOrderDto createDto);
    Task<OrderResponseDto> UpdateOrderAsync(string id, UpdateOrderDto updateDto);
    Task<bool> DeleteOrderAsync(string id);
    Task<bool> OrderExistsAsync(string id);
    Task<bool> OrderNumberExistsAsync(string orderNumber);
}

