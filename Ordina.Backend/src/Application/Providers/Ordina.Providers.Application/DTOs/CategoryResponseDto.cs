namespace Ordina.Providers.Application.DTOs;

public class CategoryAttributeDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ValueType { get; set; } = string.Empty;
    public List<AttributeValueDto> Values { get; set; } = new();
    public int? MaxSelections { get; set; }
    public decimal? MinValue { get; set; } // For "Number" type
    public decimal? MaxValue { get; set; } // For "Number" type (REQUIRED when ValueType is "Number")
}

public class AttributeValueDto
{
    public string Id { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public bool? IsDefault { get; set; }
    public decimal? PriceAdjustment { get; set; }
    public string? PriceAdjustmentCurrency { get; set; }
    public string? ProductId { get; set; }
}

public class CategoryResponseDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int Products { get; set; }
    public decimal MaxDiscount { get; set; }
    public string? MaxDiscountCurrency { get; set; }
    public List<CategoryAttributeDto> Attributes { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
