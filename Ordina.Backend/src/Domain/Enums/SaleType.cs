namespace Ordina.Domain.Enums;

public enum SaleType
{
    CustomOrder, // encargo
    Delivery,    // entrega
    Layaway      // sistema_apartado
}

public static class SaleTypeExtensions
{
    public static string ToDbString(this SaleType type) => type switch
    {
        SaleType.CustomOrder => "encargo",
        SaleType.Delivery => "entrega",
        SaleType.Layaway => "sistema_apartado",
        _ => "entrega"
    };

    public static SaleType ParseSaleType(string? value) => (value?.Trim().ToLowerInvariant()) switch
    {
        "encargo" or "customorder" => SaleType.CustomOrder,
        "sistema_apartado" or "apartado" or "layaway" => SaleType.Layaway,
        _ => SaleType.Delivery
    };
}
