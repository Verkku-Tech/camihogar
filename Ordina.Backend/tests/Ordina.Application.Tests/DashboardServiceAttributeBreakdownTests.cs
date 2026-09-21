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
        Assert.Equal(2250m, result.TotalInvoicedUsd);
        Assert.Equal(250m, result.AverageUnitPriceUsd);
        Assert.Equal(3, result.OrdersCount);
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

    [Fact]
    public async Task GetProductAttributeBreakdownAsync_CalculatesTopCombinedVariantsWithRealOrderAudit()
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
                    new() { Id = "box", Title = "Box" },
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
                OrderNumber = "ORD-101",
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
                        Quantity = 5,
                        Total = 1500m,
                        Attributes = new Dictionary<string, object>
                        {
                            { "box", "BL" },
                            { "copete", "LINEAL VERTICAL" },
                            { "tela", "LINO" }
                        }
                    }
                }
            },
            new()
            {
                Id = "ord-2",
                OrderNumber = "ORD-102",
                TypeString = "Order",
                StatusString = "Entregado",
                CreatedAt = now,
                Total = 900m,
                Products = new List<OrderProduct>
                {
                    new()
                    {
                        Name = "Cama Matrimonial",
                        Category = "Camas",
                        Quantity = 3,
                        Total = 900m,
                        Attributes = new Dictionary<string, object>
                        {
                            { "box", "BL" },
                            { "copete", "LINEAL VERTICAL" },
                            { "tela", "LINO" }
                        }
                    }
                }
            },
            new()
            {
                Id = "ord-3",
                OrderNumber = "ORD-103",
                TypeString = "Order",
                StatusString = "Entregado",
                CreatedAt = now,
                Total = 700m,
                Products = new List<OrderProduct>
                {
                    new()
                    {
                        Name = "Cama Matrimonial",
                        Category = "Camas",
                        Quantity = 2,
                        Total = 700m,
                        Attributes = new Dictionary<string, object>
                        {
                            { "box", "DT" },
                            { "copete", "ITALO" },
                            { "tela", "VELVET" }
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
        Assert.Equal(2, result.TotalUniqueVariantsCount);
        Assert.Equal(2, result.TopVariants.Count);

        // Top 1 variant: 8 units (5 from ORD-101 + 3 from ORD-102), 80%
        var top1 = result.TopVariants[0];
        Assert.Equal(1, top1.Rank);
        Assert.Equal(8, top1.UnitsSold);
        Assert.Equal(80m, top1.Percentage);
        Assert.Equal(2, top1.OrderNumbers.Count);
        Assert.Contains("ORD-101", top1.OrderNumbers);
        Assert.Contains("ORD-102", top1.OrderNumbers);
        Assert.Equal("BL", top1.Attributes["Box"]);
        Assert.Equal("LINEAL VERTICAL", top1.Attributes["Copete"]);
        Assert.Equal("LINO", top1.Attributes["Tela"]);

        // Verify enriched Orders list
        Assert.NotNull(top1.Orders);
        Assert.Equal(2, top1.Orders.Count);
        var ord101Summary = top1.Orders.First(o => o.OrderNumber == "ORD-101");
        Assert.Equal(5, ord101Summary.Quantity);
        Assert.Equal(1500m, ord101Summary.TotalUsd);
        Assert.False(string.IsNullOrWhiteSpace(ord101Summary.ClientName));

        // Top 2 variant: 2 units (ORD-103), 20%
        var top2 = result.TopVariants[1];
        Assert.Equal(2, top2.Rank);
        Assert.Equal(2, top2.UnitsSold);
        Assert.Equal(20m, top2.Percentage);
        Assert.Single(top2.OrderNumbers);
        Assert.Contains("ORD-103", top2.OrderNumbers);
        Assert.Equal("DT", top2.Attributes["Box"]);
    }

    [Fact]
    public async Task GetProductAttributeBreakdownAsync_OptionC_HeuristicSelectsStructuralAttributesAndGroupsThem()
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
                    new() { Id = "box", Title = "Box", Required = true },
                    new() { Id = "copete", Title = "Copete", Required = true },
                    new() { Id = "tela", Title = "Tela", Required = true }
                }
            }
        };
        mockRepo.Setup(r => r.GetCategoriesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(categories);

        var now = DateTime.UtcNow;
        // 10 units total:
        // - Box has 2 options: DT (8 units, 80%), BL (2 units, 20%) -> qualifies (N=2 <= 2)
        // - Copete has 2 options: LINEAL (8 units, 80%), ITALO (2 units, 20%) -> qualifies (N=2 <= 2)
        // - Tela has 4 options: Lino (3 units, 30%), Suede (3 units, 30%), Velvet (2 units, 20%), Cuero (2 units, 20%) -> N=4, pTop=30% -> does NOT qualify
        var orders = new List<Order>
        {
            new()
            {
                Id = "ord-1",
                OrderNumber = "ORD-001",
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
                        Quantity = 3,
                        Total = 300m,
                        Attributes = new Dictionary<string, object>
                        {
                            { "box", "DT" },
                            { "copete", "LINEAL" },
                            { "tela", "Lino" }
                        }
                    },
                    new()
                    {
                        Name = "Cama Matrimonial",
                        Category = "Camas",
                        Quantity = 2,
                        Total = 200m,
                        Attributes = new Dictionary<string, object>
                        {
                            { "box", "DT" },
                            { "copete", "LINEAL" },
                            { "tela", "Cuero" }
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
                Total = 300m,
                Products = new List<OrderProduct>
                {
                    new()
                    {
                        Name = "Cama Matrimonial",
                        Category = "Camas",
                        Quantity = 3,
                        Total = 300m,
                        Attributes = new Dictionary<string, object>
                        {
                            { "box", "DT" },
                            { "copete", "LINEAL" },
                            { "tela", "Suede" }
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
                Total = 200m,
                Products = new List<OrderProduct>
                {
                    new()
                    {
                        Name = "Cama Matrimonial",
                        Category = "Camas",
                        Quantity = 2,
                        Total = 200m,
                        Attributes = new Dictionary<string, object>
                        {
                            { "box", "BL" },
                            { "copete", "ITALO" },
                            { "tela", "Velvet" }
                        }
                    }
                }
            }
        };
        mockRepo.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(mockRepo.Object);

        // Act - attributeIds is null -> Option C heuristic applies
        var result = await service.GetProductAttributeBreakdownAsync("Cama Matrimonial", "month", null);

        // Assert
        Assert.NotNull(result.ActiveAttributeIds);
        Assert.Contains("box", result.ActiveAttributeIds);
        Assert.Contains("copete", result.ActiveAttributeIds);
        Assert.DoesNotContain("tela", result.ActiveAttributeIds);

        var boxAttr = result.Attributes.First(a => a.AttributeId == "box");
        var copeteAttr = result.Attributes.First(a => a.AttributeId == "copete");
        var telaAttr = result.Attributes.First(a => a.AttributeId == "tela");

        Assert.True(boxAttr.IsSuggestedForGrouping);
        Assert.True(copeteAttr.IsSuggestedForGrouping);
        Assert.False(telaAttr.IsSuggestedForGrouping);

        // Grouping is by Box + Copete:
        // Top 1: Box DT + Copete LINEAL aggregates ORD-001 (5) + ORD-002 (3) = 8 units (80%)!
        Assert.Equal(2, result.TotalUniqueVariantsCount);
        var top1 = result.TopVariants[0];
        Assert.Equal(8, top1.UnitsSold);
        Assert.Equal(80m, top1.Percentage);
        Assert.Equal(2, top1.OrderNumbers.Count);
        Assert.Contains("ORD-001", top1.OrderNumbers);
        Assert.Contains("ORD-002", top1.OrderNumbers);
        Assert.False(top1.Attributes.ContainsKey("Tela")); // Tela was excluded by heuristic C!
    }

    [Fact]
    public async Task GetProductAttributeBreakdownAsync_OptionB_FiltersByExplicitAttributeIds()
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
                    new() { Id = "box", Title = "Box", Required = true },
                    new() { Id = "copete", Title = "Copete", Required = true },
                    new() { Id = "tela", Title = "Tela", Required = true }
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
                Total = 500m,
                Products = new List<OrderProduct>
                {
                    new()
                    {
                        Name = "Cama Matrimonial",
                        Category = "Camas",
                        Quantity = 5,
                        Total = 500m,
                        Attributes = new Dictionary<string, object>
                        {
                            { "box", "DT" },
                            { "copete", "LINEAL" },
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
                Total = 300m,
                Products = new List<OrderProduct>
                {
                    new()
                    {
                        Name = "Cama Matrimonial",
                        Category = "Camas",
                        Quantity = 3,
                        Total = 300m,
                        Attributes = new Dictionary<string, object>
                        {
                            { "box", "DT" },
                            { "copete", "LINEAL" },
                            { "tela", "Suede" }
                        }
                    }
                }
            }
        };
        mockRepo.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(mockRepo.Object);

        // Act - Explicitly filter by box and tela (Option B)
        var result = await service.GetProductAttributeBreakdownAsync("Cama Matrimonial", "month", "box,tela");

        // Assert
        Assert.Equal(2, result.ActiveAttributeIds.Count);
        Assert.Contains("box", result.ActiveAttributeIds);
        Assert.Contains("tela", result.ActiveAttributeIds);
        Assert.DoesNotContain("copete", result.ActiveAttributeIds);

        // Since Tela is included, ORD-001 (DT + Lino) and ORD-002 (DT + Suede) are separate variants
        Assert.Equal(2, result.TopVariants.Count);
        Assert.Equal("DT", result.TopVariants[0].Attributes["Box"]);
        Assert.Equal("Lino", result.TopVariants[0].Attributes["Tela"]);
        Assert.Equal(5, result.TopVariants[0].UnitsSold);

        Assert.Equal("DT", result.TopVariants[1].Attributes["Box"]);
        Assert.Equal("Suede", result.TopVariants[1].Attributes["Tela"]);
        Assert.Equal(3, result.TopVariants[1].UnitsSold);
    }
}

