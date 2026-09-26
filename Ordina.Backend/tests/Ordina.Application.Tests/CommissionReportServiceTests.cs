using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Moq;
using Ordina.Application.Common;
using Ordina.Application.Reports;
using Ordina.Domain.Catalog;
using Ordina.Domain.Finance;
using Ordina.Domain.Orders;
using Ordina.Domain.Stores;
using Ordina.Domain.Users;
using Xunit;

namespace Ordina.Application.Tests;

public class CommissionReportServiceTests
{
    private readonly Mock<IOrderRepository> _orderRepoMock = new();
    private readonly Mock<IClientRepository> _clientRepoMock = new();
    private readonly Mock<IProductRepository> _productRepoMock = new();
    private readonly Mock<IExchangeRateRepository> _exchangeRateRepoMock = new();
    private readonly Mock<IRepository<ProductCommission>> _productCommissionRepoMock = new();
    private readonly Mock<IRepository<SaleTypeCommissionRule>> _saleTypeRuleRepoMock = new();
    private readonly Mock<IUserRepository> _userRepoMock = new();
    private readonly Mock<IRepository<Category>> _categoryRepoMock = new();
    private readonly Mock<ILogger<ReportService>> _loggerMock = new();

    private ReportService CreateService() => new(
        _orderRepoMock.Object,
        _clientRepoMock.Object,
        _productRepoMock.Object,
        _exchangeRateRepoMock.Object,
        null,
        null,
        _productCommissionRepoMock.Object,
        _saleTypeRuleRepoMock.Object,
        _userRepoMock.Object,
        _categoryRepoMock.Object,
        _loggerMock.Object);

    [Fact]
    public async Task GetCommissionReportAsync_CalculatesProductLevelCommissions_WithSaleTypeRulesAndExclusivity()
    {
        // Arrange
        var testDate = new DateTime(2026, 9, 26, 12, 0, 0, DateTimeKind.Utc);
        var order = new Order
        {
            Id = "ord-1",
            OrderNumber = "PED-101",
            CreatedAt = testDate,
            TypeString = "Order",
            StatusString = "Generado",
            ClientName = "Pedro Perez",
            VendorId = "v-1",
            VendorName = "Carlos Vendedor",
            ReferrerId = "v-2",
            ReferrerName = "Maria Referido",
            SaleTypeString = "entrega",
            Products = new List<OrderProduct>
            {
                new()
                {
                    Id = "p-1",
                    Name = "Colchon King",
                    Category = "Colchones",
                    Quantity = 2,
                    Price = 300m
                },
                new()
                {
                    Id = "p-2",
                    Name = "Base Cama",
                    Category = "Bases",
                    Quantity = 1,
                    Price = 100m
                }
            }
        };

        _orderRepoMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<Order, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Order> { order });

        _productCommissionRepoMock
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ProductCommission>
            {
                new() { CategoryName = "Colchones", CommissionValue = 5.0m },
                new() { CategoryName = "Bases", CommissionValue = 2.5m }
            });

        _saleTypeRuleRepoMock
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<SaleTypeCommissionRule>
            {
                new()
                {
                    SaleType = "entrega",
                    SaleTypeLabel = "Entrega",
                    FamilyCommissionUsdPerUnit = 5.0m,
                    VendorRate = 3.0m,
                    ReferrerRate = 2.0m,
                    PostventaRate = 0.0m
                },
                new()
                {
                    SaleType = "entrega",
                    SaleTypeLabel = "Entrega",
                    FamilyCommissionUsdPerUnit = 2.5m,
                    VendorRate = 1.5m,
                    ReferrerRate = 1.0m,
                    PostventaRate = 0.0m
                }
            });

        _userRepoMock
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<User>
            {
                new()
                {
                    Id = "v-1",
                    Name = "Carlos Vendedor",
                    CommissionExclusivityModeStored = "shared",
                    BaseSalary = 150m,
                    RoleString = "Store Seller",
                    StoreId = "store-1"
                },
                new()
                {
                    Id = "v-2",
                    Name = "Maria Referido",
                    CommissionExclusivityModeStored = "shared",
                    RoleString = "Online Seller"
                }
            });

        _categoryRepoMock
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Category>());

        var sut = CreateService();

        // Act
        var rows = await sut.GetCommissionReportAsync(testDate.Date, testDate.Date);

        // Assert
        Assert.NotNull(rows);
        Assert.Equal(2, rows.Count);

        var rowColchon = rows.FirstOrDefault(r => r.Descripcion.Contains("Colchon King"));
        Assert.NotNull(rowColchon);
        Assert.Equal("PED-101", rowColchon.Pedido);
        Assert.Equal(2, rowColchon.CantidadArticulos);
        Assert.Equal(5.0m, rowColchon.ComisionFamiliaUsdPorUnidad);
        Assert.Equal(6.0m, rowColchon.Comision); // 3.0 * 2
        Assert.Equal("Maria Referido", rowColchon.VendedorSecundario);
        Assert.Equal(4.0m, rowColchon.ComisionSecundaria); // 2.0 * 2
        Assert.Equal(150m, rowColchon.SueldoBase);
        Assert.Equal(156.0m, rowColchon.TotalComisionMasSueldo);
        Assert.True(rowColchon.EsVentaCompartida);

        var rowBase = rows.FirstOrDefault(r => r.Descripcion.Contains("Base Cama"));
        Assert.NotNull(rowBase);
        Assert.Equal(1, rowBase.CantidadArticulos);
        Assert.Equal(2.5m, rowBase.ComisionFamiliaUsdPorUnidad);
        Assert.Equal(1.5m, rowBase.Comision); // 1.5 * 1
        Assert.Equal(1.0m, rowBase.ComisionSecundaria); // 1.0 * 1
    }

    [Fact]
    public async Task GetCommissionReportAsync_ExcludesReservationsAndDeclinedOrders()
    {
        var testDate = new DateTime(2026, 9, 26, 12, 0, 0, DateTimeKind.Utc);
        var orders = new List<Order>
        {
            new()
            {
                Id = "ord-res",
                OrderNumber = "RES-001",
                TypeString = "Reservation",
                StatusString = "Reserva",
                CreatedAt = testDate,
                Products = new List<OrderProduct> { new() { Name = "P1", Category = "C1", Quantity = 1 } }
            },
            new()
            {
                Id = "ord-dec",
                OrderNumber = "PED-002",
                TypeString = "Order",
                StatusString = "Declinado",
                CreatedAt = testDate,
                Products = new List<OrderProduct> { new() { Name = "P2", Category = "C1", Quantity = 1 } }
            },
            new()
            {
                Id = "ord-ok",
                OrderNumber = "PED-003",
                TypeString = "Order",
                StatusString = "Generado",
                CreatedAt = testDate,
                VendorId = "v-1",
                VendorName = "Carlos",
                Products = new List<OrderProduct> { new() { Name = "P3", Category = "C1", Quantity = 1 } }
            }
        };

        _orderRepoMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<Order, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        _productCommissionRepoMock
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ProductCommission> { new() { CategoryName = "C1", CommissionValue = 5.0m } });

        _saleTypeRuleRepoMock
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<SaleTypeCommissionRule>());

        _userRepoMock
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<User> { new() { Id = "v-1", CommissionExclusivityModeStored = "exclusive" } });

        _categoryRepoMock
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Category>());

        var sut = CreateService();

        var rows = await sut.GetCommissionReportAsync(testDate.Date, testDate.Date);

        Assert.Single(rows);
        Assert.Equal("PED-003", rows[0].Pedido);
    }

    [Fact]
    public async Task GenerateCommissionsReportExcelAsync_GeneratesValidExcelWith12Columns()
    {
        var testDate = new DateTime(2026, 9, 26, 12, 0, 0, DateTimeKind.Utc);
        var order = new Order
        {
            Id = "ord-1",
            OrderNumber = "PED-101",
            CreatedAt = testDate,
            TypeString = "Order",
            StatusString = "Generado",
            ClientName = "Pedro Perez",
            VendorId = "v-1",
            VendorName = "Carlos Vendedor",
            SaleTypeString = "entrega",
            Products = new List<OrderProduct>
            {
                new()
                {
                    Name = "Colchon",
                    Category = "Colchones",
                    Quantity = 1
                }
            }
        };

        _orderRepoMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<Order, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Order> { order });

        _productCommissionRepoMock
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ProductCommission> { new() { CategoryName = "Colchones", CommissionValue = 5.0m } });

        _saleTypeRuleRepoMock
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<SaleTypeCommissionRule>());

        _userRepoMock
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<User> { new() { Id = "v-1", CommissionExclusivityModeStored = "exclusive" } });

        _categoryRepoMock
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Category>());

        var sut = CreateService();

        var bytes = await sut.GenerateCommissionsReportExcelAsync(testDate.Date, testDate.Date);

        Assert.NotNull(bytes);
        Assert.True(bytes.Length > 0);

        using var ms = new System.IO.MemoryStream(bytes);
        using var workbook = new ClosedXML.Excel.XLWorkbook(ms);
        var worksheet = workbook.Worksheet("Comisiones");
        Assert.NotNull(worksheet);

        // Verify all 12 columns
        Assert.Equal("Fecha", worksheet.Cell(1, 1).GetString());
        Assert.Equal("Cliente", worksheet.Cell(1, 2).GetString());
        Assert.Equal("Pedido", worksheet.Cell(1, 3).GetString());
        Assert.Equal("Vendedor", worksheet.Cell(1, 4).GetString());
        Assert.Equal("Descripción", worksheet.Cell(1, 5).GetString());
        Assert.Equal("Cant. Artículos", worksheet.Cell(1, 6).GetString());
        Assert.Equal("Tipo de venta", worksheet.Cell(1, 7).GetString());
        Assert.Equal("Comisión familia USD/u", worksheet.Cell(1, 8).GetString());
        Assert.Equal("Comisión Vendedor", worksheet.Cell(1, 9).GetString());
        Assert.Equal("Total Comisión + Sueldo", worksheet.Cell(1, 10).GetString());
        Assert.Equal("Comisión Post venta", worksheet.Cell(1, 11).GetString());
        Assert.Equal("Comisión Referido", worksheet.Cell(1, 12).GetString());
    }

    [Fact]
    public async Task GetCommissionReferrersInRangeAsync_ReturnsDistinctReferrers()
    {
        var testDate = new DateTime(2026, 9, 26, 12, 0, 0, DateTimeKind.Utc);
        var orders = new List<Order>
        {
            new()
            {
                OrderNumber = "PED-1",
                TypeString = "Order",
                StatusString = "Generado",
                CreatedAt = testDate,
                ReferrerId = "ref-1",
                ReferrerName = "Maria Referido"
            },
            new()
            {
                OrderNumber = "PED-2",
                TypeString = "Order",
                StatusString = "Generado",
                CreatedAt = testDate,
                ReferrerId = "ref-1",
                ReferrerName = "Maria Referido"
            },
            new()
            {
                OrderNumber = "PED-3",
                TypeString = "Order",
                StatusString = "Generado",
                CreatedAt = testDate,
                ReferrerId = "ref-2",
                ReferrerName = "Juan Referido"
            },
            new()
            {
                OrderNumber = "RES-4",
                TypeString = "Reservation",
                StatusString = "Reserva",
                CreatedAt = testDate,
                ReferrerId = "ref-3",
                ReferrerName = "Reserva Referido"
            }
        };

        _orderRepoMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<Order, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var sut = CreateService();

        var referrers = await sut.GetCommissionReferrersInRangeAsync(testDate.Date, testDate.Date);

        Assert.Equal(2, referrers.Count);
        Assert.Contains(referrers, r => r.Id == "ref-1" && r.Name == "Maria Referido");
        Assert.Contains(referrers, r => r.Id == "ref-2" && r.Name == "Juan Referido");
    }
}

