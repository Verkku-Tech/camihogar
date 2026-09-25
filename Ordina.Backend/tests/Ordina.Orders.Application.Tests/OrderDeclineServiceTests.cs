using Microsoft.Extensions.Logging.Abstractions;
using Ordina.Database.Entities.Client;
using Ordina.Database.Entities.Order;
using Ordina.Database.Repositories;
using Ordina.Orders.Application.DTOs;
using Ordina.Orders.Application.OnlineSeller;
using Ordina.Orders.Application.Services;
using Xunit;

namespace Ordina.Orders.Application.Tests;

public class OrderDeclineServiceTests
{
    private sealed class FakeOrderRepository(Order? stored) : IOrderRepository
    {
        public Order? Stored { get; set; } = stored;

        public Task<Order?> GetByIdAsync(string id) => Task.FromResult(Stored);
        public Task<Order> UpdateAsync(Order order)
        {
            Stored = order;
            return Task.FromResult(order);
        }
        public Task<bool> DeleteAsync(string id) => Task.FromResult(true);

        public Task<IEnumerable<Order>> GetAllAsync(IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IEnumerable<Order>>(Stored == null ? [] : [Stored]);

        public Task<(IEnumerable<Order> Orders, int TotalCount)> GetPagedAsync(
            int page,
            int pageSize,
            DateTime? since = null,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(((IEnumerable<Order>)(Stored == null ? Array.Empty<Order>() : new[] { Stored }), Stored == null ? 0 : 1));

        public Task<(IEnumerable<Order> Orders, int TotalCount)> GetFilteredPagedAsync(
            int page,
            int pageSize,
            OrderListFilter listFilter,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(((IEnumerable<Order>)(Stored == null ? Array.Empty<Order>() : new[] { Stored }), Stored == null ? 0 : 1));

        public Task<IEnumerable<Order>> GetByClientIdAsync(string clientId, IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IEnumerable<Order>>(Stored == null ? [] : [Stored]);

        public Task<IEnumerable<Order>> GetByStatusAsync(string status, IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IEnumerable<Order>>(Stored == null ? [] : [Stored]);

        public Task<IEnumerable<Order>> GetByCreatedAtRangeAsync(
            DateTime startInclusive,
            DateTime endInclusive,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IEnumerable<Order>>(Stored == null ? [] : [Stored]);

        public Task<Order?> GetByOrderNumberAsync(string orderNumber) => Task.FromResult(Stored);

        public Task<IReadOnlyList<Order>> SearchHeaderAsync(
            string query,
            IReadOnlyCollection<string>? matchingClientIds,
            int limit,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IReadOnlyList<Order>>(Stored == null ? [] : [Stored]);

        public Task<Order> CreateAsync(Order order) => Task.FromResult(order);
        public Task<bool> ExistsAsync(string id) => Task.FromResult(Stored != null);
        public Task<bool> OrderNumberExistsAsync(string orderNumber) => Task.FromResult(Stored != null);
        public Task<long> CountByTypeAsync(string type) => Task.FromResult(0L);

        public Task<int> GetMaxNumericSuffixForTypeAndPrefixAsync(string orderType, string prefix) =>
            Task.FromResult(0);

        public Task<int> GetFilteredCountAsync(
            OrderListFilter listFilter,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(Stored == null ? 0 : 1);

        public Task<int> GetCountAsync(
            IReadOnlyCollection<string>? onlineSellerTeamIds = null,
            DateTime? since = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(Stored == null ? 0 : 1);

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

    private sealed class FakeClientRepository : IClientRepository
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

    private sealed class FakeAuditLogService : IOrderAuditLogService
    {
        public Task LogOrderCreatedAsync(Order order, string userId, string userName) => Task.CompletedTask;
        public Task LogOrderUpdatedAsync(Order oldOrder, Order newOrder, string userId, string userName) => Task.CompletedTask;
        public Task LogOrderDeletedAsync(Order order, string userId, string userName) => Task.CompletedTask;
        public Task LogItemValidatedAsync(Order order, string itemId, string userId, string userName, string? prev = null) => Task.CompletedTask;
        public Task LogOrderDeclinedAsync(Order order, string userId, string userName, string? declineReason) => Task.CompletedTask;
        public Task LogOrderDeclineRevertedAsync(Order order, string userId, string userName) => Task.CompletedTask;
        public Task LogPaymentsConciliatedAsync(Order b, Order a, IReadOnlyList<ConciliatePaymentRequestDto> r, string u, string n) => Task.CompletedTask;
        public Task<PagedAuditLogsResponseDto> GetPagedLogsAsync(int p, int ps, string? u, string? o, string? a, DateTime? f, DateTime? t, bool s = false) => Task.FromResult(new PagedAuditLogsResponseDto());
    }

    private sealed class FakeAccessPinService : IAccessPinService
    {
        public Task<GenerateAccessPinResponseDto> GenerateAsync(string userId, string userName) => Task.FromResult(new GenerateAccessPinResponseDto());
        public Task<ValidateAccessPinResponseDto> ValidateAsync(string pin, string orderId, string userId) => Task.FromResult(new ValidateAccessPinResponseDto());
        public Task<AccessPinSessionResponseDto> GetSessionAsync(string orderId, string userId) => Task.FromResult(new AccessPinSessionResponseDto());
        public Task<bool> HasActiveSessionAsync(string orderId, string userId) => Task.FromResult(false);
        public Task<AccessPinHistoryResponseDto> GetHistoryAsync(int page, int pageSize) => Task.FromResult(new AccessPinHistoryResponseDto());
    }

    private sealed class FakeOnlineSellerVisibilityService : IOnlineSellerVisibilityService
    {
        public Task<IReadOnlyCollection<string>?> ResolveTeamFilterIdsAsync(string? callerRole, CancellationToken ct = default) => Task.FromResult<IReadOnlyCollection<string>?>(null);
        public Task<IReadOnlySet<string>> GetOnlineSellerUserIdsAsync(CancellationToken ct = default) => Task.FromResult<IReadOnlySet<string>>(new HashSet<string>());
    }

    private static (OrderService Service, FakeOrderRepository Repo) BuildService(Order order)
    {
        var repo = new FakeOrderRepository(order);
        var service = new OrderService(
            repo,
            new FakeClientRepository(),
            new FakeAuditLogService(),
            new FakeAccessPinService(),
            new FakeOnlineSellerVisibilityService(),
            NullLogger<OrderService>.Instance
        );
        return (service, repo);
    }

    [Fact]
    public async Task DeclineOrderAsync_CompletedOrder_DeclinesOrderAndAllProducts()
    {
        var order = new Order
        {
            Id = "ord-1",
            OrderNumber = "ORD-1292",
            Type = "Order",
            Status = "Completado",
            Products = new List<OrderProduct>
            {
                new() { Id = "p-1", Name = "SOFA", LogisticStatus = "Completado", LocationStatus = "DESPACHADO" }
            }
        };

        var (service, _) = BuildService(order);

        var result = await service.DeclineOrderAsync("ord-1", "user-1", "Admin", "Solicitado por lisbeth");

        Assert.Equal("Declinado", result.Status);
        Assert.Equal("Solicitado por lisbeth", result.DeclineReason);
        Assert.All(result.Products, p => Assert.Equal("Declinado", p.LogisticStatus));
    }

    [Fact]
    public async Task ReactivateOrderAsync_ReactivatesDeclinedOrderToGenerado()
    {
        var order = new Order
        {
            Id = "ord-1",
            OrderNumber = "ORD-1292",
            Type = "Order",
            Status = "Declinado",
            DeclineReason = "Solicitado por lisbeth",
            Products = new List<OrderProduct>
            {
                new() { Id = "p-1", Name = "SOFA", LogisticStatus = "Declinado" }
            }
        };

        var (service, _) = BuildService(order);

        var result = await service.ReactivateOrderAsync("ord-1", "user-1", "Admin");

        Assert.Equal("Generado", result.Status);
        Assert.Null(result.DeclineReason);
        Assert.All(result.Products, p => Assert.Equal("Generado", p.LogisticStatus));
    }
}
