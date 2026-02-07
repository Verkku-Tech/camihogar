using MongoDB.Bson;

namespace Ordina.Providers.Application.DTOs;

public class ProductResponseDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string CategoryId { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty; // Nombre de la categoría
    public decimal Price { get; set; }
    public string? PriceCurrency { get; set; }
    public int Stock { get; set; }
    public string Status { get; set; } = string.Empty;
    public string SKU { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Dictionary<string, object>? Attributes { get; set; }
    public string? ProviderId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
