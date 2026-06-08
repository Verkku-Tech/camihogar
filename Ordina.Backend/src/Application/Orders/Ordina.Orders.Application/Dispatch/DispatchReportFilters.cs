using Ordina.Database.Entities.Order;

namespace Ordina.Orders.Application.Dispatch;

/// <summary>
/// Criterios de inclusión del reporte de despacho (paridad con pestaña En Ruta en frontend).
/// </summary>
public static class DispatchReportFilters
{
    public static bool IsProductEnRuta(OrderProduct product)
    {
        var loc = product.LocationStatus?.Trim();
        if (string.Equals(loc, "EN DESPACHO", StringComparison.OrdinalIgnoreCase))
            return true;

        var log = product.LogisticStatus?.Trim();
        if (string.Equals(log, "En Ruta", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(loc, "DESPACHADO", StringComparison.OrdinalIgnoreCase))
            return true;

        return false;
    }

    public static bool IsOrderEligibleForDispatchReport(Order order)
    {
        if (OrderDocumentTypes.IsReservationType(order.Type))
            return false;
        if (order.Status is "Generado" or "Generada")
            return false;
        if (order.Products == null || order.Products.Count == 0)
            return false;
        return order.Products.Any(IsProductEnRuta);
    }

    public static IReadOnlyList<OrderProduct> GetProductsEnRuta(Order order)
    {
        if (order.Products == null || order.Products.Count == 0)
            return Array.Empty<OrderProduct>();
        return order.Products.Where(IsProductEnRuta).ToList();
    }
}
