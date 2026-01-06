namespace Ordina.Orders.Application.DTOs;

public class OrderProductDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Quantity { get; set; }
    public decimal Total { get; set; }
    public string Category { get; set; } = string.Empty;
    public int Stock { get; set; }
    public Dictionary<string, object>? Attributes { get; set; }
    public decimal? Discount { get; set; }
    public string? Observations { get; set; }
    
    // Campos de fabricación
    public string? AvailabilityStatus { get; set; }
    public string? ManufacturingStatus { get; set; }
    public string? ManufacturingProviderId { get; set; }
    public string? ManufacturingProviderName { get; set; }
    public DateTime? ManufacturingStartedAt { get; set; }
    public DateTime? ManufacturingCompletedAt { get; set; }
    public string? ManufacturingNotes { get; set; }
    public string? LocationStatus { get; set; }
    public List<ProductImageDto>? Images { get; set; } // Imágenes del producto
}

