using Ordina.Database.Entities.Order;

namespace Ordina.Database.Repositories;

public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(string id);
    Task<IEnumerable<Order>> GetAllAsync();
    Task<IEnumerable<Order>> GetByClientIdAsync(string clientId);
    Task<IEnumerable<Order>> GetByStatusAsync(string status);
    Task<Order?> GetByOrderNumberAsync(string orderNumber);
    Task<Order> CreateAsync(Order order);
    Task<Order> UpdateAsync(Order order);
    Task<bool> DeleteAsync(string id);
    Task<bool> ExistsAsync(string id);
    Task<bool> OrderNumberExistsAsync(string orderNumber);
}

