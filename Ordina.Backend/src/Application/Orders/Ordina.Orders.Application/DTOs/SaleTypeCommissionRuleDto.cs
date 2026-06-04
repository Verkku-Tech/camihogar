namespace Ordina.Orders.Application.DTOs;

public class SaleTypeCommissionRuleDto
{
    public string Id { get; set; } = string.Empty;
    public string SaleType { get; set; } = string.Empty;
    public string SaleTypeLabel { get; set; } = string.Empty;
    /// <summary>USD de comisión familia por unidad (2.5, 5 o 7.5).</summary>
    public decimal FamilyCommissionUsdPerUnit { get; set; }
    /// <summary>USD por unidad para vendedor de tienda.</summary>
    public decimal VendorRate { get; set; }
    /// <summary>USD por unidad para referido online.</summary>
    public decimal ReferrerRate { get; set; }
    /// <summary>USD por unidad para post venta.</summary>
    public decimal PostventaRate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateSaleTypeCommissionRuleDto
{
    public string SaleType { get; set; } = string.Empty;
    public string SaleTypeLabel { get; set; } = string.Empty;
    /// <summary>USD de comisión familia por unidad (2.5, 5 o 7.5).</summary>
    public decimal FamilyCommissionUsdPerUnit { get; set; }
    /// <summary>USD por unidad para vendedor de tienda.</summary>
    public decimal VendorRate { get; set; }
    /// <summary>USD por unidad para referido online.</summary>
    public decimal ReferrerRate { get; set; }
    /// <summary>USD por unidad para post venta.</summary>
    public decimal PostventaRate { get; set; }
}

public class UpdateSaleTypeCommissionRuleDto
{
    public string? SaleTypeLabel { get; set; }
    public decimal? FamilyCommissionUsdPerUnit { get; set; }
    public decimal VendorRate { get; set; }
    public decimal ReferrerRate { get; set; }
    public decimal PostventaRate { get; set; }
}
