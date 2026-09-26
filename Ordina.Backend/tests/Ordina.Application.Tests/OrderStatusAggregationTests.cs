using System.Collections.Generic;
using Ordina.Application.Orders;
using Ordina.Domain.Orders;
using Xunit;

namespace Ordina.Application.Tests;

public class OrderStatusAggregationTests
{
    [Fact]
    public void CalculateFromProducts_WithProductInManufacturingQueue_ReturnsReporteDeFabricacion()
    {
        var products = new List<OrderProduct>
        {
            new()
            {
                Id = "prod-1",
                Name = "Mesa Comedor",
                LocationStatusString = "FABRICACION",
                ManufacturingStatusString = "por_fabricar",
                LogisticStatusString = "Validado"
            }
        };

        var status = OrderStatusAggregation.CalculateFromProducts(products);

        Assert.Equal("Reporte de fabricación", status);
    }

    [Fact]
    public void CalculateFromProducts_WithProductFabricando_ReturnsFabricandose()
    {
        var products = new List<OrderProduct>
        {
            new()
            {
                Id = "prod-1",
                Name = "Mesa Comedor",
                LocationStatusString = "FABRICACION",
                ManufacturingStatusString = "fabricando",
                LogisticStatusString = "Fabricándose"
            }
        };

        var status = OrderStatusAggregation.CalculateFromProducts(products);

        Assert.Equal("Fabricándose", status);
    }

    [Fact]
    public void CalculateFromProducts_WithMixedProducts_PrefersFabricationProducts()
    {
        var products = new List<OrderProduct>
        {
            new()
            {
                Id = "prod-1",
                Name = "Silla Inmediata",
                LocationStatusString = "EN TIENDA",
                LogisticStatusString = "En Almacén"
            },
            new()
            {
                Id = "prod-2",
                Name = "Mesa Fabricación",
                LocationStatusString = "FABRICACION",
                ManufacturingStatusString = "por_fabricar",
                LogisticStatusString = "Validado"
            }
        };

        var status = OrderStatusAggregation.CalculateFromProducts(products);

        Assert.Equal("Reporte de fabricación", status);
    }
}
