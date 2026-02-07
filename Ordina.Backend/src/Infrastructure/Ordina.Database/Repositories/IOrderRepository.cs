using Ordina.Database.Entities.Order;

namespace Ordina.Database.Repositories;

public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(string id);
    Task<IEnumerable<Order>> GetAllAsync();
    
    /// <summary>
    /// Obtiene pedidos con paginación y filtro opcional por fecha de modificación
    /// </summary>
    /// <param name="page">Número de página (1-indexed)</param>
    /// <param name="pageSize">Cantidad de elementos por página</param>
    /// <param name="since">Fecha opcional para filtrar solo pedidos modificados desde esa fecha</param>
    /// <returns>Tupla con los pedidos y el total de elementos</returns>
    Task<(IEnumerable<Order> Orders, int TotalCount)> GetPagedAsync(int page, int pageSize, DateTime? since = null);
    
    Task<IEnumerable<Order>> GetByClientIdAsync(string clientId);
    Task<IEnumerable<Order>> GetByStatusAsync(string status);
    Task<Order?> GetByOrderNumberAsync(string orderNumber);
    Task<Order> CreateAsync(Order order);
    Task<Order> UpdateAsync(Order order);
    Task<bool> DeleteAsync(string id);
    Task<bool> ExistsAsync(string id);
    Task<bool> OrderNumberExistsAsync(string orderNumber);
}

