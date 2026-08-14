using Ordina.Database.Entities.Order;
using Ordina.Orders.Application.Dispatch;

namespace Ordina.Orders.Application.Tests;

public class DispatchReportFiltersTests
{
    private static OrderProduct Product(string? locationStatus, string? manufacturingStatus = null) => new()
    {
        LocationStatus = locationStatus,
        ManufacturingStatus = manufacturingStatus,
    };

    [Theory]
    [InlineData("EN TIENDA", null, "tienda")]
    [InlineData("DISPONIBILIDAD INMEDIATA", null, "almacen")]
    [InlineData("FABRICACION", "almacen_no_fabricado", "almacen")]
    [InlineData("FABRICACION", "fabricado", "almacen")]
    [InlineData("FABRICACION", "fabricando", null)]
    [InlineData("EN DESPACHO", null, null)]
    [InlineData(null, null, null)]
    public void ResolveLocation_DerivesTiendaOrAlmacenFromLocationStatus(
        string? locationStatus,
        string? manufacturingStatus,
        string? expected)
    {
        var product = Product(locationStatus, manufacturingStatus);

        var result = DispatchReportFilters.ResolveLocation(product);

        Assert.Equal(expected, result);
    }

    [Fact]
    public void ResolveLocation_PrefersStoredDispatchOrigin()
    {
        var product = Product("EN DESPACHO", null);
        product.DispatchOrigin = "tienda";

        Assert.Equal("tienda", DispatchReportFilters.ResolveLocation(product));
    }

    [Fact]
    public void IsOrderEligibleForDispatchReport_ExcludesDeclinedOrders()
    {
        var order = new Order
        {
            Type = "Order",
            Status = "Declinado",
            Products = new List<OrderProduct>
            {
                new() { LocationStatus = "EN DESPACHO", LogisticStatus = "En Ruta" },
            },
        };

        Assert.False(DispatchReportFilters.IsOrderEligibleForDispatchReport(order));
    }
}
