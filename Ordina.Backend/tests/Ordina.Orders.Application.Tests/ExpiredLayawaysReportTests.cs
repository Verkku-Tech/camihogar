using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging.Abstractions;
using Ordina.Database.Entities.Category;
using Ordina.Database.Entities.Client;
using Ordina.Database.Entities.Commission;
using Ordina.Database.Entities.Order;
using Ordina.Database.Entities.Provider;
using Ordina.Database.Entities.User;
using Ordina.Database.Repositories;
using Ordina.Orders.Application.Services;
using SpreadsheetLight;
using Xunit;

namespace Ordina.Orders.Application.Tests;

public class ExpiredLayawaysReportTests
{
    private sealed class FakeOrderRepository(List<Order> orders) : IOrderRepository
    {
        public Task<Order?> GetByIdAsync(string id) => Task.FromResult<Order?>(orders.FirstOrDefault(o => o.Id == id));
        public Task<Order> UpdateAsync(Order order) => Task.FromResult(order);
        public Task<bool> DeleteAsync(string id) => Task.FromResult(true);

        public Task<IEnumerable<Order>> GetAllAsync(IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IEnumerable<Order>>(orders);

        public Task<(IEnumerable<Order> Orders, int TotalCount)> GetPagedAsync(
            int page,
            int pageSize,
            DateTime? since = null,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(((IEnumerable<Order>)orders, orders.Count));

        public Task<(IEnumerable<Order> Orders, int TotalCount)> GetFilteredPagedAsync(
            int page,
            int pageSize,
            OrderListFilter listFilter,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(((IEnumerable<Order>)orders, orders.Count));

        public Task<IEnumerable<Order>> GetByClientIdAsync(string clientId, IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IEnumerable<Order>>(orders.Where(o => o.ClientId == clientId));

        public Task<IEnumerable<Order>> GetByStatusAsync(string status, IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IEnumerable<Order>>(orders.Where(o => o.Status == status));

        public Task<IEnumerable<Order>> GetByCreatedAtRangeAsync(
            DateTime startInclusive,
            DateTime endInclusive,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IEnumerable<Order>>(orders);

        public Task<Order?> GetByOrderNumberAsync(string orderNumber) =>
            Task.FromResult<Order?>(orders.FirstOrDefault(o => o.OrderNumber == orderNumber));

        public Task<IReadOnlyList<Order>> SearchHeaderAsync(
            string query,
            IReadOnlyCollection<string>? matchingClientIds,
            int limit,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IReadOnlyList<Order>>(orders);

        public Task<Order> CreateAsync(Order order) => Task.FromResult(order);
        public Task<bool> ExistsAsync(string id) => Task.FromResult(orders.Any(o => o.Id == id));
        public Task<bool> OrderNumberExistsAsync(string orderNumber) => Task.FromResult(orders.Any(o => o.OrderNumber == orderNumber));
        public Task<long> CountByTypeAsync(string type) => Task.FromResult((long)orders.Count);

        public Task<int> GetMaxNumericSuffixForTypeAndPrefixAsync(string orderType, string prefix) =>
            Task.FromResult(0);

        public Task<int> GetFilteredCountAsync(
            OrderListFilter listFilter,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(orders.Count);

        public Task<int> GetCountAsync(
            IReadOnlyCollection<string>? onlineSellerTeamIds = null,
            DateTime? since = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(orders.Count);

        public Task<long> UpdateClientNameByClientIdAsync(string clientId, string newClientName) =>
            Task.FromResult(0L);

        public Task<DashboardMetricsRawData> GetDashboardMetricsRawDataAsync(
            DateTime periodStart,
            DateTime periodEnd,
            DateTime prevPeriodStart,
            DateTime prevPeriodEnd,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new DashboardMetricsRawData());
    }

    [Fact]
    public async Task GenerateExpiredLayawaysReportAsync_GeneratesStyledExcelWithExpiredOrders()
    {
        var now = DateTime.UtcNow;
        var orders = new List<Order>
        {
            // 1. Expired Layaway (> 90 days, pending balance) -> MUST BE INCLUDED
            new()
            {
                Id = "order-1",
                OrderNumber = "ORD-001",
                ClientName = "Cliente Vencido 1",
                SaleType = "sistema_apartado",
                Status = "Por Fabricar",
                BaseCurrency = "USD",
                Total = 1000m,
                CreatedAt = now.AddDays(-120),
                PartialPayments = new List<PartialPayment>
                {
                    new() { Amount = 300m, PaymentDetails = new PaymentDetails { OriginalCurrency = "USD", OriginalAmount = 300m } }
                }
            },
            // 2. Not Expired Layaway (< 90 days) -> MUST BE EXCLUDED
            new()
            {
                Id = "order-2",
                OrderNumber = "ORD-002",
                ClientName = "Cliente Reciente",
                SaleType = "sistema_apartado",
                Status = "Por Fabricar",
                BaseCurrency = "USD",
                Total = 500m,
                CreatedAt = now.AddDays(-30),
            },
            // 3. Fully Paid Layaway (> 90 days, pending = 0) -> MUST BE EXCLUDED
            new()
            {
                Id = "order-3",
                OrderNumber = "ORD-003",
                ClientName = "Cliente Pagado",
                SaleType = "sistema_apartado",
                Status = "Almacén",
                BaseCurrency = "USD",
                Total = 400m,
                CreatedAt = now.AddDays(-100),
                PartialPayments = new List<PartialPayment>
                {
                    new() { Amount = 400m, PaymentDetails = new PaymentDetails { OriginalCurrency = "USD", OriginalAmount = 400m } }
                }
            },
            // 4. Cancelled Layaway -> MUST BE EXCLUDED
            new()
            {
                Id = "order-4",
                OrderNumber = "ORD-004",
                ClientName = "Cliente Cancelado",
                SaleType = "sistema_apartado",
                Status = "Cancelado",
                BaseCurrency = "USD",
                Total = 600m,
                CreatedAt = now.AddDays(-150),
            }
        };

        var service = new ReportService(
            new FakeOrderRepository(orders),
            null!,
            null!,
            null!,
            null!,
            null!,
            null!,
            null!,
            null!,
            NullLogger<ReportService>.Instance);

        var stream = await service.GenerateExpiredLayawaysReportAsync();

        Assert.NotNull(stream);
        Assert.True(stream.Length > 0);

        using var sl = new SLDocument(stream);
        // Header verification
        Assert.Equal("Pedido", sl.GetCellValueAsString(1, 1));
        Assert.Equal("Cliente", sl.GetCellValueAsString(1, 2));
        Assert.Equal("Total Pedido (USD)", sl.GetCellValueAsString(1, 3));
        Assert.Equal("Monto Cobrado (USD)", sl.GetCellValueAsString(1, 4));
        Assert.Equal("Deuda Pendiente (USD)", sl.GetCellValueAsString(1, 5));
        Assert.Equal("Fecha Creación", sl.GetCellValueAsString(1, 6));
        Assert.Equal("Días Vencidos (mora post 90 d)", sl.GetCellValueAsString(1, 7));
        Assert.Equal("Estado", sl.GetCellValueAsString(1, 8));

        // Data row 2 (only order-1 should be present)
        Assert.Equal("ORD-001", sl.GetCellValueAsString(2, 1));
        Assert.Equal("Cliente Vencido 1", sl.GetCellValueAsString(2, 2));
        Assert.Equal(1000d, sl.GetCellValueAsDouble(2, 3));
        Assert.Equal(300d, sl.GetCellValueAsDouble(2, 4));
        Assert.Equal(700d, sl.GetCellValueAsDouble(2, 5));
        Assert.Equal(30, sl.GetCellValueAsInt32(2, 7)); // 120 - 90 = 30 days
        Assert.Equal("Por Fabricar", sl.GetCellValueAsString(2, 8));

        // Total row 3
        Assert.Equal("TOTAL", sl.GetCellValueAsString(3, 1));
        Assert.Equal(1000d, sl.GetCellValueAsDouble(3, 3));
        Assert.Equal(300d, sl.GetCellValueAsDouble(3, 4));
        Assert.Equal(700d, sl.GetCellValueAsDouble(3, 5));
    }
}
