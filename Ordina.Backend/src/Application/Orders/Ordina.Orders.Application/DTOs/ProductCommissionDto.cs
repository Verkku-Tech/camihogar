namespace Ordina.Orders.Application.DTOs;

public class ProductCommissionDto
{
    public string Id { get; set; } = string.Empty;
    public string CategoryId { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public decimal CommissionValue { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateProductCommissionDto
{
    public string CategoryId { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public decimal CommissionValue { get; set; }
}

public class UpdateProductCommissionDto
{
    public decimal CommissionValue { get; set; }
}
