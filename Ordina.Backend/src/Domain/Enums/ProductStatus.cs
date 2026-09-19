namespace Ordina.Domain.Enums;

public enum ProductStatus
{
    Active,
    Inactive,
    OutOfStock
}

public static class ProductStatusExtensions
{
    public static string ToDbString(this ProductStatus status) => status switch
    {
        ProductStatus.Active => "active",
        ProductStatus.Inactive => "inactive",
        ProductStatus.OutOfStock => "out_of_stock",
        _ => "active"
    };

    public static ProductStatus ParseProductStatus(string? value) => (value?.Trim().ToLowerInvariant()) switch
    {
        "inactive" => ProductStatus.Inactive,
        "out_of_stock" or "outofstock" => ProductStatus.OutOfStock,
        _ => ProductStatus.Active
    };
}
