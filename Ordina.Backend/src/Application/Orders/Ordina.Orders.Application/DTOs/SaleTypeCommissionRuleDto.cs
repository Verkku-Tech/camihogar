namespace Ordina.Orders.Application.DTOs;

public class SaleTypeCommissionRuleDto
{
    public string Id { get; set; } = string.Empty;
    public string SaleType { get; set; } = string.Empty;
    public string SaleTypeLabel { get; set; } = string.Empty;
    public decimal VendorRate { get; set; }
    public decimal ReferrerRate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateSaleTypeCommissionRuleDto
{
    public string SaleType { get; set; } = string.Empty;
    public string SaleTypeLabel { get; set; } = string.Empty;
    public decimal VendorRate { get; set; }
    public decimal ReferrerRate { get; set; }
}

public class UpdateSaleTypeCommissionRuleDto
{
    public string? SaleTypeLabel { get; set; }
    public decimal VendorRate { get; set; }
    public decimal ReferrerRate { get; set; }
}
