using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Moq;
using Ordina.Application.Dashboard;
using Ordina.Domain.Catalog;
using Ordina.Domain.Finance;
using Ordina.Domain.Orders;
using Ordina.Domain.Stores;
using Ordina.Domain.Users;
using Xunit;

namespace Ordina.Application.Tests;

public class DashboardComprehensiveBiTests
{
    private readonly Mock<IDashboardRepository> _repoMock;
    private readonly DateTime _now;

    public DashboardComprehensiveBiTests()
    {
        _repoMock = new Mock<IDashboardRepository>();
        _now = DateTime.UtcNow;

        var rates = new List<ExchangeRate>
        {
            new() { FromCurrency = "Bs", ToCurrency = "USD", Rate = 800m, IsActive = true, EffectiveDate = _now }
        };
        _repoMock.Setup(r => r.GetExchangeRatesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(rates);

        var categories = new List<Category>
        {
            new() { Name = "Camas" },
            new() { Name = "Closets" }
        };
        _repoMock.Setup(r => r.GetCategoriesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(categories);

        var users = new List<User>
        {
            new() { Id = "ven-1", StoreId = "store-guatire", StoreName = "Tienda Guatire" },
            new() { Id = "ven-2", StoreId = "store-caracas", StoreName = "Tienda Caracas (Las Mercedes)" }
        };
        _repoMock.Setup(r => r.GetUsersAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(users);

        var stores = new List<Store>
        {
            new() { Id = "store-guatire", Name = "Tienda Guatire" },
            new() { Id = "store-caracas", Name = "Tienda Caracas (Las Mercedes)" }
        };
        _repoMock.Setup(r => r.GetStoresAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(stores);

        var rules = new List<SaleTypeCommissionRule>
        {
            new() { SaleType = "Showroom", VendorRate = 0.05m }
        };
        _repoMock.Setup(r => r.GetSaleTypeCommissionRulesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(rules);

        _repoMock.Setup(r => r.GetCommissionsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Commission>());
    }

    [Fact]
    public async Task PipelineSnapshot_Calculates_Counts_And_Usd_Totals()
    {
        var orders = new List<Order>
        {
            new()
            {
                Id = "ord-1",
                OrderNumber = "ORD-001",
                StatusString = "Pendiente",
                TypeString = "Order",
                Total = 500m,
                Products = new List<OrderProduct>
                {
                    new() { Name = "Cama King", Total = 300m, Price = 300m, Quantity = 1, LocationStatusString = "FABRICACION" },
                    new() { Name = "Colchón", Total = 200m, Price = 200m, Quantity = 1, LocationStatusString = "ALMACEN" }
                }
            }
        };
        _repoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(_repoMock.Object);

        var result = await service.GetPipelineSnapshotAsync();

        Assert.Equal(1, result.Manufacturing);
        Assert.Equal(300m, result.ManufacturingUsd);
        Assert.Equal(1, result.Warehouse);
        Assert.Equal(200m, result.WarehouseUsd);
    }

    [Fact]
    public async Task TopSellers_Calculates_Commissions_From_Rules()
    {
        var orders = new List<Order>
        {
            new()
            {
                Id = "ord-1",
                OrderNumber = "ORD-001",
                VendorId = "ven-1",
                VendorName = "Carlos Pérez",
                TypeString = "Order",
                SaleTypeString = "Showroom",
                Total = 1000m,
                CreatedAt = _now
            }
        };
        _repoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(_repoMock.Object);

        var result = await service.GetTopSellersAsync("month");

        Assert.Single(result);
        Assert.Equal("Carlos Pérez", result[0].VendorName);
        Assert.Equal(1000m, result[0].TotalUsd);
        // Rule: Showroom has 5% rate -> 1000 * 0.05 = 50
        Assert.Equal(50m, result[0].EstimatedCommissionUsd);
    }

    [Fact]
    public async Task TopSellers_Calculates_Performance_Metrics_Correctly()
    {
        var orders = new List<Order>
        {
            new()
            {
                Id = "ord-1",
                OrderNumber = "ORD-001",
                VendorId = "ven-1",
                VendorName = "María Gómez",
                TypeString = "Order",
                SaleTypeString = "Directo",
                Subtotal = 1000m,
                Total = 1000m,
                ConvertedFromNumber = "RES-999",
                Products = new List<OrderProduct>
                {
                    new() { Name = "Cama Matrimonial", Quantity = 1, Price = 700m },
                    new() { Name = "Mesa de Noche", Quantity = 2, Price = 150m }
                },
                CreatedAt = _now
            },
            new()
            {
                Id = "ord-2",
                OrderNumber = "ORD-002",
                VendorId = "ven-1",
                VendorName = "María Gómez",
                TypeString = "Order",
                SaleTypeString = "Directo",
                SubtotalBeforeDiscounts = 600m,
                Subtotal = 500m,
                Total = 500m,
                GeneralDiscountAmount = 100m,
                Products = new List<OrderProduct>
                {
                    new() { Name = "Colchón Queen", Quantity = 2, Price = 300m }
                },
                CreatedAt = _now
            },
            // Reservation (should not count as concrete order, but counts in reservation opportunities)
            new()
            {
                Id = "res-1",
                OrderNumber = "RES-101",
                VendorId = "ven-1",
                VendorName = "María Gómez",
                TypeString = "Reservation",
                Total = 800m,
                CreatedAt = _now
            },
            // Cancelled order (should be excluded completely)
            new()
            {
                Id = "ord-can",
                OrderNumber = "ORD-999",
                VendorId = "ven-1",
                VendorName = "María Gómez",
                StatusString = "Cancelado",
                Total = 2000m,
                CreatedAt = _now
            }
        };

        _repoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(_repoMock.Object);
        var result = await service.GetTopSellersAsync("month");

        Assert.Single(result);
        var seller = result[0];
        Assert.Equal("ven-1", seller.VendorId);
        Assert.Equal("María Gómez", seller.VendorName);
        Assert.Equal(2, seller.OrdersCount);
        Assert.Equal(1500m, seller.TotalUsd);
        Assert.Equal(750m, seller.AverageTicketUsd); // 1500 / 2
        Assert.Equal(2.5, seller.UnitsPerOrder); // (3 units + 2 units) / 2 orders = 2.5
        // Discounts: 100 discount on 1600 gross subtotal = 6.25% -> 6.3%
        Assert.Equal(6.3m, seller.AverageDiscountPercent);
        // Conversion: 1 converted order (from RES-999) + 1 pending reservation (RES-101) = 2 ops -> 50%
        Assert.Equal(50.0m, seller.ReservationConversionRate);
        Assert.Equal(1, seller.ConvertedReservationsCount);
    }

    [Fact]
    public async Task AovByBranch_Groups_By_StoreName_Correctly()
    {
        var orders = new List<Order>
        {
            new()
            {
                Id = "ord-1",
                OrderNumber = "ORD-001",
                VendorId = "ven-1",
                TypeString = "Order",
                Total = 600m,
                CreatedAt = _now
            },
            new()
            {
                Id = "ord-2",
                OrderNumber = "ORD-002",
                VendorId = "ven-1",
                TypeString = "Order",
                Total = 400m,
                CreatedAt = _now
            },
            new()
            {
                Id = "ord-3",
                OrderNumber = "ORD-003",
                VendorId = "ven-2",
                TypeString = "Order",
                Total = 800m,
                CreatedAt = _now
            }
        };
        _repoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(_repoMock.Object);

        var result = await service.GetAovByBranchAsync("month");

        Assert.Equal(2, result.Count);
        var guatire = Assert.Single(result, r => r.BranchName == "Tienda Guatire");
        Assert.Equal(2, guatire.OrdersCount);
        Assert.Equal(1000m, guatire.TotalSalesUsd);
        Assert.Equal(500m, guatire.AverageOrderValue); // (600+400)/2 = 500
    }

    [Fact]
    public async Task PaymentMix_And_Aging_Calculations()
    {
        var orders = new List<Order>
        {
            new()
            {
                Id = "ord-1",
                OrderNumber = "ORD-001",
                TypeString = "Order",
                StatusString = "Pendiente",
                Total = 500m,
                CreatedAt = _now.AddDays(-20),
                PartialPayments = new List<PartialPayment>
                {
                    new()
                    {
                        Amount = 200m,
                        Date = _now.AddDays(-19),
                        Method = "Zelle",
                        PaymentDetails = new PaymentDetails { OriginalCurrency = "USD", OriginalAmount = 200m }
                    }
                }
            }
        };
        _repoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(_repoMock.Object);

        var paymentMix = await service.GetPaymentMixAsync("month");
        var zelle = Assert.Single(paymentMix, p => p.Method == "Zelle");
        Assert.Equal(200m, zelle.TotalUsd);
        Assert.Equal(100m, zelle.Percentage);

        var aging = await service.GetAgingUnliquidatedAsync();
        var range16to30 = Assert.Single(aging, a => a.Range == "16-30d");
        Assert.Equal(1, range16to30.Count);
        Assert.Equal(300m, range16to30.TotalBalanceUsd); // 500 - 200 = 300
    }

    [Fact]
    public async Task Funnel_ConversionRate_And_ClosingVelocity()
    {
        var orders = new List<Order>
        {
            // Reserva formalizada en orden
            new()
            {
                Id = "ord-1",
                OrderNumber = "ORD-100",
                ConvertedFromNumber = "RES-001",
                TypeString = "Order",
                Total = 450m,
                CreatedAt = _now.AddDays(-5),
                PartialPayments = new List<PartialPayment>
                {
                    new() { Amount = 100m, Date = _now.AddDays(-4), PaymentDetails = new PaymentDetails { OriginalCurrency = "USD", OriginalAmount = 100m } }
                }
            },
            // Reserva no convertida
            new()
            {
                Id = "res-2",
                OrderNumber = "RES-002",
                TypeString = "reservation",
                Total = 300m,
                CreatedAt = _now.AddDays(-10)
            }
        };
        _repoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(_repoMock.Object);

        var conversion = await service.GetConversionRateAsync("month");
        Assert.Equal(2, conversion.TotalReservations);
        Assert.Equal(1, conversion.ConvertedOrders);
        Assert.Equal(50m, conversion.WinRatePercentage); // 1 de 2 = 50%
        Assert.Equal(450m, conversion.ConvertedVolumeUsd);

        var velocity = await service.GetClosingVelocityAsync("month");
        Assert.Equal(1, velocity.AnalyzedOrdersCount);
        Assert.True(velocity.AverageDaysToClose >= 0.9 && velocity.AverageDaysToClose <= 1.1); // ~1 day (24h)
    }

    [Fact]
    public async Task Reservation_IsStrictlyExcluded_From_Billing_Aging_And_Layaways()
    {
        var orders = new List<Order>
        {
            // Pedido válido
            new()
            {
                Id = "ord-valid",
                OrderNumber = "ORD-001",
                TypeString = "Order",
                SaleTypeString = "directo",
                StatusString = "Pendiente",
                Total = 500m,
                CreatedAt = _now.AddDays(-20),
                PartialPayments = new List<PartialPayment>()
            },
            // Reserva que NO debe aparecer en facturación ni saldos ni SA
            new()
            {
                Id = "res-leak",
                OrderNumber = "RES-999",
                TypeString = "Reservation",
                SaleTypeString = "reserva",
                StatusString = "Pendiente",
                Total = 1500m,
                CreatedAt = _now.AddDays(-100),
                PartialPayments = new List<PartialPayment>()
            },
            // Presupuesto que tampoco debe aparecer
            new()
            {
                Id = "pre-leak",
                OrderNumber = "PRE-100",
                TypeString = "Budget",
                SaleTypeString = "presupuesto",
                StatusString = "Pendiente",
                Total = 800m,
                CreatedAt = _now.AddDays(-40)
            }
        };

        _repoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(_repoMock.Object);

        // 1. Aging Unliquidated
        var aging = await service.GetAgingUnliquidatedAsync();
        var totalAgingUsd = 0m;
        foreach (var a in aging) totalAgingUsd += a.TotalBalanceUsd;
        Assert.Equal(500m, totalAgingUsd); // Sólo ORD-001

        // 2. Expired Layaways
        var expired = await service.GetExpiredLayawaysByAgeAsync();
        var totalExpiredUsd = 0m;
        foreach (var e in expired) totalExpiredUsd += e.TotalUsd;
        Assert.Equal(0m, totalExpiredUsd); // Ninguno es SA válido

        // 3. Drill-down unliquidated orders
        var drillOrders = await service.GetAgingOrdersAsync("unliquidated");
        Assert.Single(drillOrders);
        Assert.Equal("ORD-001", drillOrders[0].OrderNumber);
        Assert.DoesNotContain(drillOrders, o => o.OrderNumber.StartsWith("RES-") || o.OrderNumber.StartsWith("PRE-"));
    }

    [Fact]
    public async Task AgingOrders_DrillDown_And_Excel_Generation()
    {
        var orders = new List<Order>
        {
            new()
            {
                Id = "ord-aging-1",
                OrderNumber = "ORD-201",
                TypeString = "Order",
                SaleTypeString = "sistema_apartado",
                StatusString = "Pendiente",
                VendorId = "ven-1",
                VendorName = "Vendedor Test",
                ClientName = "Cliente Test",
                Total = 600m,
                CreatedAt = _now.AddDays(-95),
                PartialPayments = new List<PartialPayment>
                {
                    new() { Amount = 100m, PaymentDetails = new PaymentDetails { OriginalCurrency = "USD", OriginalAmount = 100m } }
                }
            }
        };

        _repoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(_repoMock.Object);

        // Drill-down for expired layaways with range 90-120d
        var layaways = await service.GetAgingOrdersAsync("expired_layaways", "90-120d");
        Assert.Single(layaways);
        Assert.Equal("ORD-201", layaways[0].OrderNumber);
        Assert.Equal(500m, layaways[0].PendingBalanceUsd); // 600 - 100 = 500
        Assert.Equal("Tienda Guatire", layaways[0].StoreName);

        // Excel file generation
        var excelBytes = await service.GenerateAgingOrdersExcelAsync("expired_layaways", "90-120d");
        Assert.NotNull(excelBytes);
        Assert.True(excelBytes.Length > 100);
        // Valid ZIP header for .xlsx ("PK\x03\x04")
        Assert.Equal(0x50, excelBytes[0]); // 'P'
        Assert.Equal(0x4B, excelBytes[1]); // 'K'
    }

    [Fact]
    public async Task OrdersDrilldown_Filters_Correctly_And_Excludes_Reservations()
    {
        var orders = new List<Order>
        {
            // Current period normal order
            new()
            {
                Id = "ord-1",
                OrderNumber = "ORD-001",
                SaleTypeString = "directa",
                StatusString = "Pendiente",
                Total = 500m,
                CreatedAt = _now.AddMinutes(-30),
                PartialPayments = new List<PartialPayment>
                {
                    new() { Amount = 200m, PaymentDetails = new PaymentDetails { OriginalCurrency = "USD", OriginalAmount = 200m } }
                }
            },
            // Current period reservation - must be ignored
            new()
            {
                Id = "res-1",
                OrderNumber = "RES-999",
                SaleTypeString = "reserva",
                StatusString = "Pendiente",
                Total = 300m,
                CreatedAt = _now.AddMinutes(-20)
            },
            // Active Layaway (< 90 days)
            new()
            {
                Id = "sa-1",
                OrderNumber = "SA-001",
                SaleTypeString = "sistema_apartado",
                StatusString = "Pendiente",
                Total = 400m,
                CreatedAt = _now.AddDays(-30),
                PartialPayments = new List<PartialPayment>
                {
                    new() { Amount = 100m, PaymentDetails = new PaymentDetails { OriginalCurrency = "USD", OriginalAmount = 100m } }
                }
            }
        };

        _repoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(_repoMock.Object);

        // Period: day (today)
        var todayOrders = await service.GetOrdersDrilldownAsync("orders", "day");
        Assert.Single(todayOrders);
        Assert.Equal("ORD-001", todayOrders[0].OrderNumber);
        Assert.Equal(500m, todayOrders[0].TotalUsd);
        Assert.Equal(200m, todayOrders[0].PaidUsd);
        Assert.Equal(300m, todayOrders[0].PendingBalanceUsd);

        // Active layaways
        var activeLayaways = await service.GetOrdersDrilldownAsync("active_layaways", "month");
        Assert.Single(activeLayaways);
        Assert.Equal("SA-001", activeLayaways[0].OrderNumber);
        Assert.Equal(300m, activeLayaways[0].PendingBalanceUsd);

        // Excel export
        var excelBytes = await service.GenerateOrdersDrilldownExcelAsync("orders", "day");
        Assert.NotNull(excelBytes);
        Assert.Equal(0x50, excelBytes[0]);
        Assert.Equal(0x4B, excelBytes[1]);
    }

    [Fact]
    public async Task CollectedDrilldown_Splits_Current_Period_And_Prior_Period_Correctly()
    {
        var orders = new List<Order>
        {
            // Order created today, with payment today (Current period)
            new()
            {
                Id = "ord-current",
                OrderNumber = "ORD-CURR",
                SaleTypeString = "directa",
                StatusString = "Pagado",
                VendorId = "ven-1",
                CreatedAt = _now.AddSeconds(-30),
                PartialPayments = new List<PartialPayment>
                {
                    new()
                    {
                        Id = "pay-1",
                        Date = _now.AddSeconds(-15),
                        Amount = 150m,
                        Method = "Transferencia",
                        PaymentDetails = new PaymentDetails { OriginalCurrency = "USD", OriginalAmount = 150m, TransferenciaReference = "REF-1" }
                    }
                }
            },
            // Order created 2 months ago (prior period), but payment received today (Cartera)
            new()
            {
                Id = "ord-prior",
                OrderNumber = "ORD-PRIOR",
                SaleTypeString = "sistema_apartado",
                StatusString = "Pendiente",
                VendorId = "ven-2",
                CreatedAt = _now.AddDays(-60),
                PartialPayments = new List<PartialPayment>
                {
                    new()
                    {
                        Id = "pay-2",
                        Date = _now.AddSeconds(-10),
                        Amount = 250m,
                        Method = "Efectivo",
                        PaymentDetails = new PaymentDetails { OriginalCurrency = "USD", CashReceived = 250m }
                    }
                }
            },
            // Reservation payment today - must be ignored!
            new()
            {
                Id = "res-ignore",
                OrderNumber = "RES-001",
                SaleTypeString = "reserva",
                CreatedAt = _now.AddMinutes(-50),
                PartialPayments = new List<PartialPayment>
                {
                    new()
                    {
                        Id = "pay-res",
                        Date = _now.AddMinutes(-10),
                        Amount = 100m,
                        PaymentDetails = new PaymentDetails { OriginalCurrency = "USD", OriginalAmount = 100m }
                    }
                }
            }
        };

        _repoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(_repoMock.Object);

        var result = await service.GetCollectedDrilldownAsync("day");

        // Verifications
        Assert.Single(result.CurrentPeriodPayments);
        Assert.Equal("ORD-CURR", result.CurrentPeriodPayments[0].OrderNumber);
        Assert.Equal(150m, result.CurrentPeriodPayments[0].AmountUsd);
        Assert.Equal("Tienda Guatire", result.CurrentPeriodPayments[0].StoreName);

        Assert.Single(result.PriorPeriodPayments);
        Assert.Equal("ORD-PRIOR", result.PriorPeriodPayments[0].OrderNumber);
        Assert.Equal(250m, result.PriorPeriodPayments[0].AmountUsd);
        Assert.Equal("Tienda Caracas (Las Mercedes)", result.PriorPeriodPayments[0].StoreName);

        Assert.Equal(400m, result.TotalCollectedUsd);
        Assert.Equal(150m, result.CurrentPeriodCollectedUsd);
        Assert.Equal(250m, result.PriorPeriodCollectedUsd);
        Assert.Equal(37.5m, result.CurrentPeriodPercentage);
        Assert.Equal(62.5m, result.PriorPeriodPercentage);

        // Excel export multi-sheet
        var excelBytes = await service.GenerateCollectedDrilldownExcelAsync("day");
        Assert.NotNull(excelBytes);
        Assert.Equal(0x50, excelBytes[0]);
        Assert.Equal(0x4B, excelBytes[1]);
    }

    [Fact]
    public async Task CasheaDrilldown_Calculates_Financed_And_Collected_Balances()
    {
        var orders = new List<Order>
        {
            new()
            {
                Id = "ord-cashea-1",
                OrderNumber = "CASHEA-001",
                SaleTypeString = "directa",
                StatusString = "Completado",
                VendorId = "ven-1",
                Total = 1000m,
                CreatedAt = _now.AddMinutes(-30),
                PartialPayments = new List<PartialPayment>
                {
                    // Down payment paid in store
                    new()
                    {
                        Amount = 400m,
                        Method = "Punto de Venta",
                        PaymentDetails = new PaymentDetails { OriginalCurrency = "USD", OriginalAmount = 400m, CasheaFinancedPortion = false }
                    },
                    // Cashea financed portion (conciliated / collected)
                    new()
                    {
                        Amount = 300m,
                        Method = "Cashea",
                        PaymentDetails = new PaymentDetails { OriginalCurrency = "USD", OriginalAmount = 300m, CasheaFinancedPortion = true, IsConciliated = true }
                    },
                    // Cashea financed portion (not conciliated / pending)
                    new()
                    {
                        Amount = 300m,
                        Method = "Cashea",
                        PaymentDetails = new PaymentDetails { OriginalCurrency = "USD", OriginalAmount = 300m, CasheaFinancedPortion = true, IsConciliated = false }
                    }
                }
            }
        };

        _repoMock.Setup(r => r.GetAllOrdersForDashboardAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(orders);

        var service = new DashboardService(_repoMock.Object);

        var result = await service.GetCasheaDrilldownAsync("day");

        Assert.Single(result.Orders);
        var item = result.Orders[0];
        Assert.Equal("CASHEA-001", item.OrderNumber);
        Assert.Equal(1000m, item.TotalOrderUsd);
        Assert.Equal(400m, item.DownPaymentUsd);
        Assert.Equal(600m, item.FinancedCasheaUsd);
        Assert.Equal(300m, item.CollectedCasheaUsd);
        Assert.Equal(300m, item.PendingCasheaUsd);

        Assert.Equal(1000m, result.TotalOrdersVolumeUsd);
        Assert.Equal(400m, result.TotalDownPaymentUsd);
        Assert.Equal(600m, result.TotalFinancedCasheaUsd);
        Assert.Equal(300m, result.TotalCollectedCasheaUsd);
        Assert.Equal(300m, result.TotalPendingCasheaUsd);

        // Excel export
        var excelBytes = await service.GenerateCasheaDrilldownExcelAsync("day");
        Assert.NotNull(excelBytes);
        Assert.Equal(0x50, excelBytes[0]);
        Assert.Equal(0x4B, excelBytes[1]);
    }
}

