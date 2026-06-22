namespace Ordina.Database.Repositories;

/// <summary>Filtros opcionales para listado paginado de pedidos/presupuestos.</summary>
public class OrderListFilter
{
    public string? Search { get; set; }
    public string? ClientSearch { get; set; }
    public string? Vendor { get; set; }
    public string? Status { get; set; }
    public string? SaleType { get; set; }
    public DateTime? DateFrom { get; set; }
    public DateTime? DateTo { get; set; }
    public bool IncludeBudgets { get; set; } = true;

    /// <summary>IDs de clientes resueltos por <see cref="ClientSearch"/> (llenado en capa de servicio).</summary>
    public IReadOnlyCollection<string>? MatchingClientIds { get; set; }

    public bool HasActiveFilters =>
        !string.IsNullOrWhiteSpace(Search)
        || !string.IsNullOrWhiteSpace(ClientSearch)
        || !string.IsNullOrWhiteSpace(Vendor)
        || !string.IsNullOrWhiteSpace(Status)
        || !string.IsNullOrWhiteSpace(SaleType)
        || DateFrom.HasValue
        || DateTo.HasValue;
}
