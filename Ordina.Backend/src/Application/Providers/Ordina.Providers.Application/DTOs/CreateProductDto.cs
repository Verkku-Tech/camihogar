using System.ComponentModel.DataAnnotations;

namespace Ordina.Providers.Application.DTOs;

public class CreateProductDto
{
    [Required(ErrorMessage = "El nombre del producto es requerido")]
    [StringLength(200, MinimumLength = 2, ErrorMessage = "El nombre debe tener entre 2 y 200 caracteres")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "El SKU es requerido")]
    [StringLength(100, ErrorMessage = "El SKU no puede exceder 100 caracteres")]
    public string SKU { get; set; } = string.Empty;

    [StringLength(2000, ErrorMessage = "La descripción no puede exceder 2000 caracteres")]
    public string? Description { get; set; }

    // CategoryId es opcional - el backend lo resolverá por nombre si está vacío (para PWA offline-first)
    public string? CategoryId { get; set; }

    [Required(ErrorMessage = "El nombre de la categoría es requerido")]
    [StringLength(200, ErrorMessage = "El nombre de la categoría no puede exceder 200 caracteres")]
    public string Category { get; set; } = string.Empty;

    [Required(ErrorMessage = "El precio es requerido")]
    [Range(0, double.MaxValue, ErrorMessage = "El precio debe ser mayor o igual a 0")]
    public decimal Price { get; set; }

    [StringLength(3, ErrorMessage = "La moneda no puede exceder 3 caracteres")]
    public string? PriceCurrency { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "El stock debe ser mayor o igual a 0")]
    public int Stock { get; set; } = 0;

    [StringLength(50, ErrorMessage = "El estado no puede exceder 50 caracteres")]
    public string Status { get; set; } = "Disponible";

    public Dictionary<string, object>? Attributes { get; set; }

    public string? ProviderId { get; set; }
}
