using System.ComponentModel.DataAnnotations;

namespace Ordina.Providers.Application.DTOs;

public class CreateCategoryAttributeDto
{
    [Required(ErrorMessage = "El título del atributo es requerido")]
    [StringLength(200, ErrorMessage = "El título no puede exceder 200 caracteres")]
    public string Title { get; set; } = string.Empty;

    [StringLength(500, ErrorMessage = "La descripción no puede exceder 500 caracteres")]
    public string Description { get; set; } = string.Empty;

    [Required(ErrorMessage = "El tipo de valor es requerido")]
    [StringLength(50, ErrorMessage = "El tipo de valor no puede exceder 50 caracteres")]
    public string ValueType { get; set; } = string.Empty;

    public List<CreateAttributeValueDto> Values { get; set; } = new();
    public int? MaxSelections { get; set; }
    public decimal? MinValue { get; set; } // For "Number" type
    public decimal? MaxValue { get; set; } // For "Number" type (REQUIRED when ValueType is "Number")
}

public class CreateAttributeValueDto
{
    [Required(ErrorMessage = "El label es requerido")]
    [StringLength(200, ErrorMessage = "El label no puede exceder 200 caracteres")]
    public string Label { get; set; } = string.Empty;

    public bool? IsDefault { get; set; }
    public decimal? PriceAdjustment { get; set; }
    public string? PriceAdjustmentCurrency { get; set; }
    public string? ProductId { get; set; }
}

public class CreateCategoryDto
{
    [Required(ErrorMessage = "El nombre de la categoría es requerido")]
    [StringLength(200, MinimumLength = 2, ErrorMessage = "El nombre debe tener entre 2 y 200 caracteres")]
    public string Name { get; set; } = string.Empty;

    [StringLength(1000, ErrorMessage = "La descripción no puede exceder 1000 caracteres")]
    public string Description { get; set; } = string.Empty;

    [Range(0, double.MaxValue, ErrorMessage = "El descuento máximo debe ser mayor o igual a 0")]
    public decimal MaxDiscount { get; set; }

    [StringLength(3, ErrorMessage = "La moneda no puede exceder 3 caracteres")]
    public string? MaxDiscountCurrency { get; set; }

    public List<CreateCategoryAttributeDto> Attributes { get; set; } = new();
}
