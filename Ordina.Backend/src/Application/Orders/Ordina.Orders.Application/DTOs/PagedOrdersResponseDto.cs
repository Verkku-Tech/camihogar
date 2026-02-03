namespace Ordina.Orders.Application.DTOs;

/// <summary>
/// Respuesta paginada de pedidos con información de sincronización
/// </summary>
public class PagedOrdersResponseDto
{
    /// <summary>
    /// Lista de pedidos en la página actual
    /// </summary>
    public IEnumerable<OrderResponseDto> Orders { get; set; } = new List<OrderResponseDto>();
    
    /// <summary>
    /// Número de página actual (1-indexed)
    /// </summary>
    public int Page { get; set; }
    
    /// <summary>
    /// Cantidad de elementos por página
    /// </summary>
    public int PageSize { get; set; }
    
    /// <summary>
    /// Total de elementos (sin paginar)
    /// </summary>
    public int TotalCount { get; set; }
    
    /// <summary>
    /// Total de páginas disponibles
    /// </summary>
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)TotalCount / PageSize) : 0;
    
    /// <summary>
    /// Indica si hay más páginas después de la actual
    /// </summary>
    public bool HasNextPage => Page < TotalPages;
    
    /// <summary>
    /// Indica si hay páginas anteriores a la actual
    /// </summary>
    public bool HasPreviousPage => Page > 1;
    
    /// <summary>
    /// Timestamp del servidor para sincronización incremental
    /// El cliente debe guardar este valor y usarlo en la siguiente consulta con el parámetro 'since'
    /// </summary>
    public DateTime ServerTimestamp { get; set; } = DateTime.UtcNow;
}
