using System.ComponentModel.DataAnnotations;

namespace Ordina.Providers.Application.DTOs;

public class UpdateCategoryAttributeDto
{
    public string? Id { get; set; }

    [StringLength(200, ErrorMessage = "El título no puede exceder 200 caracteres")]
    public string? Title { get; set; }

    [StringLength(500, ErrorMessage = "La descripción no puede exceder 500 caracteres")]
    public string? Description { get; set; }

    [StringLength(50, ErrorMessage = "El tipo de valor no puede exceder 50 caracteres")]
    public string? ValueType { get; set; }

    public List<UpdateAttributeValueDto>? Values { get; set; }
    public int? MaxSelections { get; set; }
    public decimal? MinValue { get; set; } // For "Number" type
    public decimal? MaxValue { get; set; } // For "Number" type (REQUIRED when ValueType is "Number")
    public bool? Required { get; set; } // Indica si el atributo es obligatorio (por defecto true)
}

public class UpdateAttributeValueDto
{
    public string? Id { get; set; }

    [StringLength(200, ErrorMessage = "El label no puede exceder 200 caracteres")]
    public string? Label { get; set; }

    public bool? IsDefault { get; set; }
    public decimal? PriceAdjustment { get; set; }
    public string? PriceAdjustmentCurrency { get; set; }
    public string? ProductId { get; set; }
}

public class UpdateCategoryDto
{
    [StringLength(200, MinimumLength = 2, ErrorMessage = "El nombre debe tener entre 2 y 200 caracteres")]
    public string? Name { get; set; }

    [StringLength(1000, ErrorMessage = "La descripción no puede exceder 1000 caracteres")]
    public string? Description { get; set; }

    [Range(0, double.MaxValue, ErrorMessage = "El descuento máximo debe ser mayor o igual a 0")]
    public decimal? MaxDiscount { get; set; }

    [StringLength(3, ErrorMessage = "La moneda no puede exceder 3 caracteres")]
    public string? MaxDiscountCurrency { get; set; }

    public List<UpdateCategoryAttributeDto>? Attributes { get; set; }
}
