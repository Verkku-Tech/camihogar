using Ordina.Database.Entities.Order;

namespace Ordina.Database.Repositories;

public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(string id);
    Task<IEnumerable<Order>> GetAllAsync(IReadOnlyCollection<string>? onlineSellerTeamIds = null);
    
    /// <summary>
    /// Obtiene pedidos con paginación y filtro opcional por fecha de modificación
    /// </summary>
    /// <param name="page">Número de página (1-indexed)</param>
    /// <param name="pageSize">Cantidad de elementos por página</param>
    /// <param name="since">Fecha opcional para filtrar solo pedidos modificados desde esa fecha</param>
    /// <param name="onlineSellerTeamIds">Si se indica, solo pedidos con vendedor/referidor/reserva online en el equipo</param>
    /// <returns>Tupla con los pedidos y el total de elementos</returns>
    Task<(IEnumerable<Order> Orders, int TotalCount)> GetPagedAsync(
        int page,
        int pageSize,
        DateTime? since = null,
        IReadOnlyCollection<string>? onlineSellerTeamIds = null);

    /// <summary>Listado paginado con filtros de búsqueda (ignora sincronización incremental).</summary>
    Task<(IEnumerable<Order> Orders, int TotalCount)> GetFilteredPagedAsync(
        int page,
        int pageSize,
        OrderListFilter listFilter,
        IReadOnlyCollection<string>? onlineSellerTeamIds = null);
    
    Task<IEnumerable<Order>> GetByClientIdAsync(
        string clientId,
        IReadOnlyCollection<string>? onlineSellerTeamIds = null);
    Task<IEnumerable<Order>> GetByStatusAsync(
        string status,
        IReadOnlyCollection<string>? onlineSellerTeamIds = null);

    /// <summary>Pedidos cuyo <see cref="Order.CreatedAt"/> cae en el rango inclusive.</summary>
    Task<IEnumerable<Order>> GetByCreatedAtRangeAsync(
        DateTime startInclusive,
        DateTime endInclusive,
        IReadOnlyCollection<string>? onlineSellerTeamIds = null);

    Task<Order?> GetByOrderNumberAsync(string orderNumber);

    /// <summary>Búsqueda para header: regex en número/cliente + clientIds coincidentes (incluye reservas RES-/PCF-).</summary>
    Task<IReadOnlyList<Order>> SearchHeaderAsync(
        string query,
        IReadOnlyCollection<string>? matchingClientIds,
        int limit,
        IReadOnlyCollection<string>? onlineSellerTeamIds = null);

    Task<Order> CreateAsync(Order order);
    Task<Order> UpdateAsync(Order order);
    Task<bool> DeleteAsync(string id);
    Task<bool> ExistsAsync(string id);
    Task<bool> OrderNumberExistsAsync(string orderNumber);

    /// <summary>Cuenta documentos por <see cref="Order.Type"/> sin cargar toda la colección.</summary>
    Task<long> CountByTypeAsync(string type);

    /// <summary>
    /// Máximo sufijo numérico de <c>orderNumber</c> con formato <c>{prefix}{dígitos}</c> para el tipo dado
    /// (p. ej. tipo Order y prefijo ORD-). Si no hay coincidencias, devuelve 0.
    /// </summary>
    Task<int> GetMaxNumericSuffixForTypeAndPrefixAsync(string orderType, string prefix);
}
