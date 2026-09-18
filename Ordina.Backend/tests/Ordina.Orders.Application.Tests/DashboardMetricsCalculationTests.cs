using Microsoft.Extensions.Logging.Abstractions;
using Ordina.Database.Entities.Client;
using Ordina.Database.Entities.Order;
using Ordina.Database.Repositories;
using Ordina.Orders.Application.DTOs;
using Ordina.Orders.Application.OnlineSeller;
using Ordina.Orders.Application.Services;

namespace Ordina.Orders.Application.Tests;

public class DashboardMetricsCalculationTests
{
    private sealed class MetricsOrderRepositoryStub(DashboardMetricsRawData rawData) : IOrderRepository
    {
        public Task<DashboardMetricsRawData> GetDashboardMetricsRawDataAsync(
            DateTime periodStart,
            DateTime periodEnd,
            DateTime prevPeriodStart,
            DateTime prevPeriodEnd,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(rawData);

        public Task<Order?> GetByIdAsync(string id) => Task.FromResult<Order?>(null);
        public Task<Order> UpdateAsync(Order order) => Task.FromResult(order);
        public Task<bool> DeleteAsync(string id) => Task.FromResult(true);
        public Task<IEnumerable<Order>> GetAllAsync(IReadOnlyCollection<string>? onlineSellerTeamIds = null) => Task.FromResult<IEnumerable<Order>>([]);
        public Task<(IEnumerable<Order> Orders, int TotalCount)> GetPagedAsync(
            int page,
            int pageSize,
            DateTime? since = null,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult((Enumerable.Empty<Order>(), 0));

        public Task<(IEnumerable<Order> Orders, int TotalCount)> GetFilteredPagedAsync(
            int page,
            int pageSize,
            OrderListFilter listFilter,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult((Enumerable.Empty<Order>(), 0));

        public Task<IEnumerable<Order>> GetByClientIdAsync(string clientId, IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IEnumerable<Order>>([]);

        public Task<IEnumerable<Order>> GetByStatusAsync(string status, IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IEnumerable<Order>>([]);

        public Task<IEnumerable<Order>> GetByCreatedAtRangeAsync(
            DateTime startInclusive,
            DateTime endInclusive,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IEnumerable<Order>>([]);

        public Task<Order?> GetByOrderNumberAsync(string orderNumber) => Task.FromResult<Order?>(null);

        public Task<IReadOnlyList<Order>> SearchHeaderAsync(
            string query,
            IReadOnlyCollection<string>? matchingClientIds,
            int limit,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IReadOnlyList<Order>>([]);

        public Task<Order> CreateAsync(Order order) => Task.FromResult(order);
        public Task<bool> ExistsAsync(string id) => Task.FromResult(false);
        public Task<bool> OrderNumberExistsAsync(string orderNumber) => Task.FromResult(false);
        public Task<long> CountByTypeAsync(string type) => Task.FromResult(0L);
        public Task<int> GetMaxNumericSuffixForTypeAndPrefixAsync(string orderType, string prefix) => Task.FromResult(0);
        public Task<int> GetFilteredCountAsync(OrderListFilter listFilter, IReadOnlyCollection<string>? onlineSellerTeamIds = null, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<int> GetCountAsync(IReadOnlyCollection<string>? onlineSellerTeamIds = null, DateTime? since = null, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<long> UpdateClientNameByClientIdAsync(string clientId, string newClientName) => Task.FromResult(0L);
    }

    private sealed class DummyClientRepository : IClientRepository
    {
        public Task<Client?> GetByIdAsync(string id) => Task.FromResult<Client?>(null);
        public Task<(IEnumerable<Client> Items, long TotalCount)> GetAllAsync(int page, int pageSize, string? search) => Task.FromResult((Enumerable.Empty<Client>(), 0L));
        public Task<IEnumerable<Client>> GetAllAsync() => Task.FromResult<IEnumerable<Client>>([]);
        public Task<IReadOnlyList<string>> FindIdsBySearchAsync(string search, int limit) => Task.FromResult<IReadOnlyList<string>>([]);
        public Task<Client?> GetByRutIdAsync(string rutId) => Task.FromResult<Client?>(null);
        public Task<IEnumerable<Client>> GetByEstadoAsync(string estado) => Task.FromResult<IEnumerable<Client>>([]);
        public Task<Client> CreateAsync(Client client) => throw new NotSupportedException();
        public Task<Client> UpdateAsync(Client client) => throw new NotSupportedException();
        public Task<bool> DeleteAsync(string id) => throw new NotSupportedException();
        public Task<bool> ExistsAsync(string id) => Task.FromResult(false);
        public Task<bool> RutIdExistsAsync(string rutId) => Task.FromResult(false);
    }

    private sealed class DummyAuditLogService : IOrderAuditLogService
    {
        public Task LogOrderCreatedAsync(Order order, string userId, string userName) => Task.CompletedTask;
        public Task LogOrderUpdatedAsync(Order oldOrder, Order newOrder, string userId, string userName) => Task.CompletedTask;
        public Task LogOrderDeletedAsync(Order order, string userId, string userName) => Task.CompletedTask;
        public Task LogItemValidatedAsync(Order order, string itemId, string userId, string userName, string? previousLogisticStatus = null) => Task.CompletedTask;
        public Task LogOrderDeclinedAsync(Order order, string userId, string userName, string? declineReason) => Task.CompletedTask;
        public Task LogOrderDeclineRevertedAsync(Order order, string userId, string userName) => Task.CompletedTask;
        public Task LogPaymentsConciliatedAsync(Order orderBefore, Order orderAfter, IReadOnlyList<ConciliatePaymentRequestDto> requests, string userId, string userName) => Task.CompletedTask;
        public Task<PagedAuditLogsResponseDto> GetPagedLogsAsync(int page, int pageSize, string? userId, string? orderNumber, string? action, DateTime? fromUtc, DateTime? toUtc, bool sortAscending = false) => Task.FromResult(new PagedAuditLogsResponseDto());
    }

    private sealed class DummyAccessPinService : IAccessPinService
    {
        public Task<GenerateAccessPinResponseDto> GenerateAsync(string userId, string userName) => Task.FromResult(new GenerateAccessPinResponseDto());
        public Task<ValidateAccessPinResponseDto> ValidateAsync(string pin, string orderId, string userId) => Task.FromResult(new ValidateAccessPinResponseDto());
        public Task<AccessPinSessionResponseDto> GetSessionAsync(string orderId, string userId) => Task.FromResult(new AccessPinSessionResponseDto());
        public Task<bool> HasActiveSessionAsync(string orderId, string userId) => Task.FromResult(false);
        public Task<AccessPinHistoryResponseDto> GetHistoryAsync(int page, int pageSize) => Task.FromResult(new AccessPinHistoryResponseDto());
    }

    private sealed class DummyOnlineSellerVisibilityService : IOnlineSellerVisibilityService
    {
        public Task<IReadOnlySet<string>> GetOnlineSellerUserIdsAsync(CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlySet<string>>(new HashSet<string>());
        public Task<IReadOnlyCollection<string>?> ResolveTeamFilterIdsAsync(string? callerRole, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyCollection<string>?>(null);
    }

    [Fact]
    public async Task GetDashboardMetricsAsync_CalculatesVariationsCorrectly()
    {
        var rawData = new DashboardMetricsRawData
        {
            CurrentOrdersCount = 10,
            PreviousOrdersCount = 5,
            CurrentInvoicedUsd = 2000m,
            PreviousInvoicedUsd = 1000m,
            CurrentCollectedUsd = 1500m,
            PreviousCollectedUsd = 1000m,
            PendingPaymentsUsd = 500m,
            ExpiredLayawaysCount = 3,
            ExpiredLayawaysAmountUsd = 450m,
            ProductsToManufactureCount = 12
        };

        var service = new OrderService(
            new MetricsOrderRepositoryStub(rawData),
            new DummyClientRepository(),
            new DummyAuditLogService(),
            new DummyAccessPinService(),
            new DummyOnlineSellerVisibilityService(),
            NullLogger<OrderService>.Instance);

        var result = await service.GetDashboardMetricsAsync("day");

        Assert.Equal(10, result.CompletedOrders);
        Assert.NotNull(result.CompletedOrdersChange);
        Assert.Equal(100.0m, result.CompletedOrdersChange!.Value);
        Assert.Equal(10m, result.CompletedOrdersChange.Current);
        Assert.Equal(5m, result.CompletedOrdersChange.Previous);

        Assert.Equal(2000m, result.TotalInvoiced);
        Assert.NotNull(result.TotalInvoicedChange);
        Assert.Equal(100.0m, result.TotalInvoicedChange!.Value);

        Assert.Equal(1500m, result.TotalCollected);
        Assert.NotNull(result.TotalCollectedChange);
        Assert.Equal(50.0m, result.TotalCollectedChange!.Value);

        Assert.Equal(200m, result.AverageOrderValue); // 2000 / 10 = 200
        Assert.Equal(500m, result.PendingPayments);
        Assert.Equal(3, result.ExpiredLayawaysCount);
        Assert.Equal(450m, result.ExpiredLayawaysAmount);
        Assert.Equal(12, result.ProductsToManufacture);
    }
}
