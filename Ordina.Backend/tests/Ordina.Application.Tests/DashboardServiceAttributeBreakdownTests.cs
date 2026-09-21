using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Moq;
using Ordina.Application.Dashboard;
using Ordina.Domain.Catalog;
using Ordina.Domain.Finance;
using Ordina.Domain.Orders;
using Xunit;

namespace Ordina.Application.Tests;

public class DashboardServiceAttributeBreakdownTests
{
    [Fact]
    public void TopProductDto_SupportsHasAttributesParameter()
    {
        var dto = new TopProductDto("Cama Matrimonial", "Camas", 10, 2500m, HasAttributes: true);
        Assert.True(dto.HasAttributes);
    }

    [Fact]
    public async Task GetTopProductsAsync_MarksHasAttributes_WhenCategoryHasAttributes()
    {
        // Arrange
        var mockRepo = new Mock<IDashboardRepository>();
        mockRepo.Setup(r => r.GetExchangeRatesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ExchangeRate>());

        var categories = new List<Category>
        {
            new()
            {
                Name = "Camas",
                Attributes = new List<CategoryAttribute>
                {
                    new() { Id = "copete", Title = "Copete" }
                }
            },
            new()
            {
                Name = "Colchones",
                Attributes = new List<CategoryAttribute>()
            }
        };
        mockRepo.Setup(r => r.GetCategoriesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(categories);

        var now = DateTime.UtcNow;
        var orders = new List<Order>
        {
            new()
            {
                Id = "ord-1",
                OrderNumber = "ORD-001",
                TypeString = "Order",
                StatusString = "Entregado",
                CreatedAt = now,
                Total = 1000m,
                Products = new List<OrderProduct>
                {
                    new() { Name = "Cama Matrimonial", Category = "Camas", Quantity = 2, Total = 500m },
                    new() { Name = "Colchón Ortopédico", Category = "Colchones", Quantity = 1, Total = 500m }
                }
            }
        };
        mockRepo.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(mockRepo.Object);

        // Act
        var result = await service.GetTopProductsAsync("month");

        // Assert
        Assert.Equal(2, result.Count);
        var cama = result.First(p => p.ProductName == "Cama Matrimonial");
        var colchon = result.First(p => p.ProductName == "Colchón Ortopédico");

        Assert.True(cama.HasAttributes);
        Assert.False(colchon.HasAttributes);
    }

    [Fact]
    public async Task GetProductAttributeBreakdownAsync_AggregatesAndSortsByUnitsSoldDescending()
    {
        // Arrange
        var mockRepo = new Mock<IDashboardRepository>();
        var categories = new List<Category>
        {
            new()
            {
                Name = "Camas",
                Attributes = new List<CategoryAttribute>
                {
                    new() { Id = "copete", Title = "Copete" },
                    new() { Id = "tela", Title = "Tela" }
                }
            }
        };
        mockRepo.Setup(r => r.GetCategoriesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(categories);

        var now = DateTime.UtcNow;
        var orders = new List<Order>
        {
            new()
            {
                Id = "ord-1",
                OrderNumber = "ORD-001",
                TypeString = "Order",
                StatusString = "Entregado",
                CreatedAt = now,
                Total = 1500m,
                Products = new List<OrderProduct>
                {
                    new()
                    {
                        Name = "Cama Matrimonial",
                        Category = "Camas",
                        Quantity = 3,
                        Total = 750m,
                        Attributes = new Dictionary<string, object>
                        {
                            { "copete", "Capitoneado" },
                            { "tela", "Lino" }
                        }
                    }
                }
            },
            new()
            {
                Id = "ord-2",
                OrderNumber = "ORD-002",
                TypeString = "Order",
                StatusString = "Entregado",
                CreatedAt = now,
                Total = 500m,
                Products = new List<OrderProduct>
                {
                    new()
                    {
                        Name = "Cama Matrimonial",
                        Category = "Camas",
                        Quantity = 2,
                        Total = 500m,
                        Attributes = new Dictionary<string, object>
                        {
                            { "copete", "Liso" },
                            { "tela", "Lino" }
                        }
                    }
                }
            },
            new()
            {
                Id = "ord-3",
                OrderNumber = "ORD-003",
                TypeString = "Order",
                StatusString = "Entregado",
                CreatedAt = now,
                Total = 1000m,
                Products = new List<OrderProduct>
                {
                    new()
                    {
                        Name = "Cama Matrimonial",
                        Category = "Camas",
                        Quantity = 4,
                        Total = 1000m,
                        Attributes = new Dictionary<string, object>
                        {
                            { "Copete", "Capitoneado" }, // Mixed casing test
                            { "tela", "Terciopelo" }
                        }
                    }
                }
            }
        };
        mockRepo.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(mockRepo.Object);

        // Act
        var result = await service.GetProductAttributeBreakdownAsync("Cama Matrimonial", "month");

        // Assert
        Assert.Equal("Cama Matrimonial", result.ProductName);
        Assert.Equal("Camas", result.Category);
        Assert.Equal(9, result.TotalUnitsSold);
        Assert.Equal(2, result.Attributes.Count);

        var copeteAttr = result.Attributes.First(a => a.AttributeTitle == "Copete");
        Assert.Equal(9, copeteAttr.TotalUnitsWithAttribute);
        Assert.Equal(2, copeteAttr.Options.Count);
        Assert.Equal("Capitoneado", copeteAttr.Options[0].Value);
        Assert.Equal(7, copeteAttr.Options[0].UnitsSold);
        Assert.Equal(77.78m, copeteAttr.Options[0].Percentage);
        Assert.Equal("Liso", copeteAttr.Options[1].Value);
        Assert.Equal(2, copeteAttr.Options[1].UnitsSold);
        Assert.Equal(22.22m, copeteAttr.Options[1].Percentage);

        var telaAttr = result.Attributes.First(a => a.AttributeTitle == "Tela");
        Assert.Equal(9, telaAttr.TotalUnitsWithAttribute);
        Assert.Equal("Lino", telaAttr.Options[0].Value);
        Assert.Equal(5, telaAttr.Options[0].UnitsSold);
        Assert.Equal(55.56m, telaAttr.Options[0].Percentage);
        Assert.Equal("Terciopelo", telaAttr.Options[1].Value);
        Assert.Equal(4, telaAttr.Options[1].UnitsSold);
        Assert.Equal(44.44m, telaAttr.Options[1].Percentage);
    }

    [Fact]
    public async Task GetProductAttributeBreakdownAsync_HandlesArrayAttributesAndResolvesValueLabels()
    {
        // Arrange
        var mockRepo = new Mock<IDashboardRepository>();
        var categories = new List<Category>
        {
            new()
            {
                Name = "Camas",
                Attributes = new List<CategoryAttribute>
                {
                    new()
                    {
                        Id = "tela",
                        Title = "Tela",
                        Values = new List<AttributeValue>
                        {
                            new() { Id = "val_lino_01", Label = "Lino Premium" },
                            new() { Id = "val_ter_02", Label = "Terciopelo Italiano" }
                        }
                    },
                    new()
                    {
                        Id = "color",
                        Title = "Color"
                    }
                }
            }
        };
        mockRepo.Setup(r => r.GetCategoriesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(categories);

        var now = DateTime.UtcNow;
        var orders = new List<Order>
        {
            new()
            {
                Id = "ord-1",
                OrderNumber = "ORD-001",
                TypeString = "Order",
                StatusString = "Entregado",
                CreatedAt = now,
                Total = 1000m,
                Products = new List<OrderProduct>
                {
                    new()
                    {
                        Name = "Cama Matrimonial",
                        Category = "Camas",
                        Quantity = 3,
                        Total = 1000m,
                        Attributes = new Dictionary<string, object>
                        {
                            // Stored as object array with attribute value ID
                            { "tela", new object[] { "val_lino_01" } },
                            // Stored as string array with raw label
                            { "color", new string[] { "Gris Plomo" } }
                        }
                    }
                }
            }
        };
        mockRepo.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(mockRepo.Object);

        // Act
        var result = await service.GetProductAttributeBreakdownAsync("Cama Matrimonial", "month");

        // Assert
        var telaAttr = result.Attributes.First(a => a.AttributeTitle == "Tela");
        Assert.Single(telaAttr.Options);
        // Must be the resolved label "Lino Premium", NOT "System.Object[]" or "val_lino_01"
        Assert.Equal("Lino Premium", telaAttr.Options[0].Value);
        Assert.Equal(3, telaAttr.Options[0].UnitsSold);

        var colorAttr = result.Attributes.First(a => a.AttributeTitle == "Color");
        Assert.Single(colorAttr.Options);
        // Must be "Gris Plomo", NOT "System.Object[]"
        Assert.Equal("Gris Plomo", colorAttr.Options[0].Value);
        Assert.Equal(3, colorAttr.Options[0].UnitsSold);
    }
}
