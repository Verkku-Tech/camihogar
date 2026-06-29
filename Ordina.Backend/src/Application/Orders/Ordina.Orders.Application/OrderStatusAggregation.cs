using Ordina.Database.Entities.Order;

namespace Ordina.Orders.Application;

/// <summary>
/// Agregación del estado del pedido a partir de las líneas de producto.
/// En pedidos mixtos (fabricación + inmediata/en tienda), solo cuentan las líneas en FABRICACION.
/// </summary>
public static class OrderStatusAggregation
{
    public static string CalculateFromProducts(IEnumerable<OrderProduct> products)
    {
        var productList = products?.ToList() ?? new List<OrderProduct>();
        if (productList.Count == 0)
            return "Generado";

        var statusProducts = SelectProductsForStatusAggregation(productList);

        bool hasGenerado = false;
        bool hasValidado = false;
        bool hasFabricandose = false;
        bool hasReporteFabricacion = false;
        bool hasEnAlmacen = false;
        bool hasEnRuta = false;
        bool allCompletado = true;

        foreach (var product in statusProducts)
        {
            var status = product.LogisticStatus ?? "Generado";
            if (status != "Completado")
                allCompletado = false;

            var inFabricacion = IsFabricationLocation(product.LocationStatus);
            var manufacturing = NormalizeManufacturingStatus(product.ManufacturingStatus);
            var inManufacturingQueue = inFabricacion && manufacturing == "por_fabricar";
            var inManufacturingActive = inFabricacion && manufacturing == "fabricando";

            if (status == "Generado" || status == "Pendiente")
                hasGenerado = true;
            else if (status == "Fabricándose" || inManufacturingActive)
                hasFabricandose = true;
            else if (inManufacturingQueue)
                hasReporteFabricacion = true;
            else if (status == "Validado")
                hasValidado = true;
            else if (status == "En Almacén")
                hasEnAlmacen = true;
            else if (status == "En Ruta")
                hasEnRuta = true;
        }

        if (allCompletado)
            return "Completado";
        if (hasGenerado)
            return "Generado";
        if (hasFabricandose)
            return "Fabricándose";
        if (hasReporteFabricacion)
            return "Reporte de fabricación";
        if (hasValidado)
            return "Validado";
        if (hasEnAlmacen)
            return "En Almacén";
        if (hasEnRuta)
            return "En Ruta";

        return "Generado";
    }

    /// <summary>
    /// Si hay más de una línea y mezcla FABRICACION con otras ubicaciones, solo las de fabricación.
    /// </summary>
    public static IReadOnlyList<OrderProduct> SelectProductsForStatusAggregation(
        IReadOnlyList<OrderProduct> products)
    {
        if (products.Count <= 1)
            return products;

        var fabrication = products
            .Where(p => IsFabricationLocation(p.LocationStatus))
            .ToList();
        var nonFabrication = products
            .Where(p => !IsFabricationLocation(p.LocationStatus))
            .ToList();

        if (fabrication.Count > 0 && nonFabrication.Count > 0)
            return fabrication;

        return products;
    }

    public static bool IsFabricationLocation(string? locationStatus)
    {
        return string.Equals(locationStatus?.Trim(), "FABRICACION", StringComparison.OrdinalIgnoreCase);
    }

    public static string NormalizeManufacturingStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
            return "debe_fabricar";

        var normalized = status.Trim().ToLowerInvariant();
        if (normalized == "fabricado")
            return "almacen_no_fabricado";

        return normalized switch
        {
            "debe_fabricar" or "por_fabricar" or "fabricando" or "almacen_no_fabricado" => normalized,
            _ => "debe_fabricar",
        };
    }
}
