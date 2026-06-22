namespace Ordina.Orders.Application.DTOs;

/// <summary>Filtros opcionales para el listado paginado de pedidos en GET /api/Orders.</summary>
public class OrderListFilterDto
{
    public string? Search { get; set; }
    public string? ClientSearch { get; set; }
    public string? Vendor { get; set; }
    public string? Status { get; set; }
    public string? SaleType { get; set; }
    public DateTime? DateFrom { get; set; }
    public DateTime? DateTo { get; set; }
    public bool IncludeBudgets { get; set; } = true;

    public bool HasActiveFilters =>
        !string.IsNullOrWhiteSpace(Search)
        || !string.IsNullOrWhiteSpace(ClientSearch)
        || !string.IsNullOrWhiteSpace(Vendor)
        || !string.IsNullOrWhiteSpace(Status)
        || !string.IsNullOrWhiteSpace(SaleType)
        || DateFrom.HasValue
        || DateTo.HasValue;
}
