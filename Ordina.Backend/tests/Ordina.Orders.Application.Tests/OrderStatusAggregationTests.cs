using Ordina.Database.Entities.Order;
using Ordina.Orders.Application;

namespace Ordina.Orders.Application.Tests;

public class OrderStatusAggregationTests
{
    private static OrderProduct FabLine(
        string logisticStatus,
        string? manufacturingStatus = null,
        string locationStatus = "FABRICACION") =>
        new()
        {
            LocationStatus = locationStatus,
            ManufacturingStatus = manufacturingStatus,
            LogisticStatus = logisticStatus,
        };

    private static OrderProduct ImmediateLine(string logisticStatus = "Validado") =>
        new()
        {
            LocationStatus = "DISPONIBILIDAD INMEDIATA",
            LogisticStatus = logisticStatus,
        };

    [Fact]
    public void MixedFabricationEnAlmacenAndImmediateValidado_ReturnsEnAlmacen()
    {
        var products = new[]
        {
            FabLine("En Almacén", "almacen_no_fabricado"),
            ImmediateLine("Validado"),
        };

        var status = OrderStatusAggregation.CalculateFromProducts(products);

        Assert.Equal("En Almacén", status);
    }

    [Fact]
    public void MixedFabricationDebeFabricarAndImmediateValidado_ReturnsValidado()
    {
        var products = new[]
        {
            FabLine("Validado", "debe_fabricar"),
            ImmediateLine("Validado"),
        };

        var status = OrderStatusAggregation.CalculateFromProducts(products);

        Assert.Equal("Validado", status);
    }

    [Fact]
    public void MixedFabricationPorFabricarAndImmediateValidado_ReturnsReporteFabricacion()
    {
        var products = new[]
        {
            FabLine("Validado", "por_fabricar"),
            ImmediateLine("Validado"),
        };

        var status = OrderStatusAggregation.CalculateFromProducts(products);

        Assert.Equal("Reporte de fabricación", status);
    }

    [Fact]
    public void OnlyImmediateLines_UsesAllProducts()
    {
        var products = new[]
        {
            ImmediateLine("Validado"),
            new OrderProduct
            {
                LocationStatus = "EN TIENDA",
                LogisticStatus = "Validado",
            },
        };

        var status = OrderStatusAggregation.CalculateFromProducts(products);

        Assert.Equal("Validado", status);
    }

    [Fact]
    public void SingleFabricationLine_UsesExistingFlow()
    {
        var products = new[] { FabLine("En Almacén", "almacen_no_fabricado") };

        var status = OrderStatusAggregation.CalculateFromProducts(products);

        Assert.Equal("En Almacén", status);
    }
}
