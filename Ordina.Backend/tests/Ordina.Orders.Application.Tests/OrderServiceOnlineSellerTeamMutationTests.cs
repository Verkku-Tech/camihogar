using Microsoft.Extensions.Logging.Abstractions;
using Ordina.Database.Entities.Client;
using Ordina.Database.Entities.Order;
using Ordina.Database.Repositories;
using Ordina.Orders.Application.DTOs;
using Ordina.Orders.Application.OnlineSeller;
using Ordina.Orders.Application.Services;

namespace Ordina.Orders.Application.Tests;

public class OrderServiceOnlineSellerTeamMutationTests
{
    private static OrderService BuildService(
        Order? stored,
        HashSet<string> onlineSellerTeamIds,
        IOrderRepository? repository = null,
        IOrderAuditLogService? audit = null) =>
        new(
            repository ?? new FakeOrderRepository(stored),
            new FakeClientRepository(),
            audit ?? new FakeAuditLogService(),
            new FakeAccessPinService(),
            new FakeOnlineSellerVisibilityService(onlineSellerTeamIds),
            NullLogger<OrderService>.Instance);

    private static Order Order(string vendorId, string? referrerId = null, string? sourceReservationVendorId = null) =>
        new()
        {
            Id = "507f1f77bcf86cd799439011",
            OrderNumber = "ORD-1",
            VendorId = vendorId,
            ReferrerId = referrerId,
            SourceReservationVendorId = sourceReservationVendorId,
        };

    [Fact]
    public async Task UpdateOrderAsync_OnlineSeller_CanUpdateTeamOrder()
    {
        var team = new HashSet<string>(StringComparer.Ordinal) { "online-a", "online-b" };
        var order = Order("online-a");
        var service = BuildService(order, team);

        var result = await service.UpdateOrderAsync(
            "order-1",
            new UpdateOrderDto(),
            "online-b",
            "Online B",
            callerRole: "Online Seller",
            callerHasOrdersUpdate: true);

        Assert.Equal("ORD-1", result.OrderNumber);
    }

    [Fact]
    public async Task UpdateOrderAsync_OnlineSeller_CanUpdateOrderReferredByTeamMember()
    {
        var team = new HashSet<string>(StringComparer.Ordinal) { "online-b" };
        var order = Order("store-1", referrerId: "online-b");
        var service = BuildService(order, team);

        var result = await service.UpdateOrderAsync(
            "order-1",
            new UpdateOrderDto(),
            "online-b",
            "Online B",
            callerRole: "Online Seller",
            callerHasOrdersUpdate: true);

        Assert.Equal("ORD-1", result.OrderNumber);
    }

    [Fact]
    public async Task UpdateOrderAsync_OnlineSeller_CannotUpdateStoreOnlyOrder()
    {
        var team = new HashSet<string>(StringComparer.Ordinal) { "online-b" };
        var order = Order("store-1");
        var service = BuildService(order, team);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.UpdateOrderAsync(
                "order-1",
                new UpdateOrderDto(),
                "online-b",
                "Online B",
                callerRole: "Online Seller",
                callerHasOrdersUpdate: true));
    }

    [Fact]
    public async Task UpdateOrderAsync_OnlineSeller_CannotUpdateOrderOfSellerOutsideTeam()
    {
        var team = new HashSet<string>(StringComparer.Ordinal) { "online-b" };
        var order = Order("online-c");
        var service = BuildService(order, team);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.UpdateOrderAsync(
                "order-1",
                new UpdateOrderDto(),
                "online-b",
                "Online B",
                callerRole: "Online Seller",
                callerHasOrdersUpdate: true));
    }

    [Fact]
    public async Task UpdateOrderAsync_NonOnlineSeller_CanUpdateAnyOrder()
    {
        var order = Order("store-1");
        var service = BuildService(order, new HashSet<string>(StringComparer.Ordinal));

        var result = await service.UpdateOrderAsync(
            "order-1",
            new UpdateOrderDto(),
            "store-1",
            "Store 1",
            callerRole: "Store Seller",
            callerHasOrdersUpdate: true);

        Assert.Equal("ORD-1", result.OrderNumber);
    }

    [Fact]
    public async Task DeleteOrderAsync_OnlineSeller_CanDeleteTeamOrder()
    {
        var team = new HashSet<string>(StringComparer.Ordinal) { "online-a", "online-b" };
        var order = Order("online-a");
        var service = BuildService(order, team);

        var result = await service.DeleteOrderAsync(
            "order-1",
            "online-b",
            "Online B",
            callerRole: "Online Seller");

        Assert.True(result);
    }

    [Fact]
    public async Task DeleteOrderAsync_OnlineSeller_CannotDeleteStoreOnlyOrder()
    {
        var team = new HashSet<string>(StringComparer.Ordinal) { "online-b" };
        var order = Order("store-1");
        var service = BuildService(order, team);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.DeleteOrderAsync(
                "order-1",
                "online-b",
                "Online B",
                callerRole: "Online Seller"));
    }

    private sealed class FakeOrderRepository(Order? stored) : IOrderRepository
    {
        public Task<Order?> GetByIdAsync(string id) => Task.FromResult(stored);
        public Task<Order> UpdateAsync(Order order) => Task.FromResult(order);
        public Task<bool> DeleteAsync(string id) => Task.FromResult(true);

        public Task<IEnumerable<Order>> GetAllAsync(IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IEnumerable<Order>>(stored == null ? [] : [stored]);

        public Task<(IEnumerable<Order> Orders, int TotalCount)> GetPagedAsync(
            int page,
            int pageSize,
            DateTime? since = null,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null)
        {
            IEnumerable<Order> items = stored == null ? Array.Empty<Order>() : new[] { stored };
            return Task.FromResult((items, stored == null ? 0 : 1));
        }

        public Task<(IEnumerable<Order> Orders, int TotalCount)> GetFilteredPagedAsync(
            int page,
            int pageSize,
            OrderListFilter listFilter,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null)
        {
            IEnumerable<Order> items = stored == null ? Array.Empty<Order>() : new[] { stored };
            return Task.FromResult((items, stored == null ? 0 : 1));
        }

        public Task<IEnumerable<Order>> GetByClientIdAsync(string clientId, IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IEnumerable<Order>>(stored == null ? [] : [stored]);

        public Task<IEnumerable<Order>> GetByStatusAsync(string status, IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IEnumerable<Order>>(stored == null ? [] : [stored]);

        public Task<IEnumerable<Order>> GetByCreatedAtRangeAsync(
            DateTime startInclusive,
            DateTime endInclusive,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IEnumerable<Order>>(stored == null ? [] : [stored]);

        public Task<Order?> GetByOrderNumberAsync(string orderNumber) => Task.FromResult(stored);

        public Task<IReadOnlyList<Order>> SearchHeaderAsync(
            string query,
            IReadOnlyCollection<string>? matchingClientIds,
            int limit,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null) =>
            Task.FromResult<IReadOnlyList<Order>>(stored == null ? [] : [stored]);

        public Task<Order> CreateAsync(Order order) => Task.FromResult(order);
        public Task<bool> ExistsAsync(string id) => Task.FromResult(stored != null);
        public Task<bool> OrderNumberExistsAsync(string orderNumber) => Task.FromResult(stored != null);
        public Task<long> CountByTypeAsync(string type) => Task.FromResult(0L);

        public Task<int> GetMaxNumericSuffixForTypeAndPrefixAsync(string orderType, string prefix) =>
            Task.FromResult(0);
    }

    private sealed class FakeClientRepository : IClientRepository
    {
        public Task<Client?> GetByIdAsync(string id) => Task.FromResult<Client?>(null);
        public Task<(IEnumerable<Client> Items, long TotalCount)> GetAllAsync(int page, int pageSize, string? search) =>
            Task.FromResult((Enumerable.Empty<Client>(), 0L));
        public Task<IEnumerable<Client>> GetAllAsync() =>
            Task.FromResult<IEnumerable<Client>>(Array.Empty<Client>());
        public Task<IReadOnlyList<string>> FindIdsBySearchAsync(string search, int limit) =>
            Task.FromResult<IReadOnlyList<string>>(Array.Empty<string>());
        public Task<Client?> GetByRutIdAsync(string rutId) => Task.FromResult<Client?>(null);
        public Task<IEnumerable<Client>> GetByEstadoAsync(string estado) =>
            Task.FromResult<IEnumerable<Client>>(Array.Empty<Client>());
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
        public Task LogItemValidatedAsync(Order order, string itemId, string userId, string userName, string? previousLogisticStatus = null) => Task.CompletedTask;
        public Task LogOrderDeclinedAsync(Order order, string userId, string userName, string? declineReason) => Task.CompletedTask;
        public Task LogOrderDeclineRevertedAsync(Order order, string userId, string userName) => Task.CompletedTask;
        public Task LogPaymentsConciliatedAsync(Order orderBefore, Order orderAfter, IReadOnlyList<ConciliatePaymentRequestDto> requests, string userId, string userName) => Task.CompletedTask;

        public Task<PagedAuditLogsResponseDto> GetPagedLogsAsync(
            int page,
            int pageSize,
            string? userId,
            string? orderNumber,
            string? action,
            DateTime? fromUtc,
            DateTime? toUtc,
            bool sortAscending = false) =>
            Task.FromResult(new PagedAuditLogsResponseDto());
    }

    private sealed class FakeAccessPinService : IAccessPinService
    {
        public Task<GenerateAccessPinResponseDto> GenerateAsync(string userId, string userName) =>
            Task.FromResult(new GenerateAccessPinResponseDto());
        public Task<ValidateAccessPinResponseDto> ValidateAsync(string pin, string orderId, string userId) =>
            Task.FromResult(new ValidateAccessPinResponseDto());
        public Task<AccessPinSessionResponseDto> GetSessionAsync(string orderId, string userId) =>
            Task.FromResult(new AccessPinSessionResponseDto());
        public Task<bool> HasActiveSessionAsync(string orderId, string userId) => Task.FromResult(false);
        public Task<AccessPinHistoryResponseDto> GetHistoryAsync(int page, int pageSize) =>
            Task.FromResult(new AccessPinHistoryResponseDto());
    }

    private sealed class FakeOnlineSellerVisibilityService(HashSet<string> onlineSellerUserIds) : IOnlineSellerVisibilityService
    {
        public Task<IReadOnlySet<string>> GetOnlineSellerUserIdsAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlySet<string>>(onlineSellerUserIds);

        public Task<IReadOnlyCollection<string>?> ResolveTeamFilterIdsAsync(
            string? callerRole,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyCollection<string>?>(onlineSellerUserIds);
    }
}