using Microsoft.Extensions.Logging.Abstractions;
using Ordina.Database.Entities.Client;
using Ordina.Database.Entities.Order;
using Ordina.Database.Repositories;
using Ordina.Orders.Application.DTOs;
using Ordina.Orders.Application.OnlineSeller;
using Ordina.Orders.Application.Services;

namespace Ordina.Orders.Application.Tests;

public class BulkUpdateProductStatusTests
{
    private static OrderService BuildService(Order stored) =>
        new(
            new FakeOrderRepository(stored),
            new FakeClientRepository(),
            new FakeAuditLogService(),
            new FakeAccessPinService(),
            new FakeOnlineSellerVisibilityService(),
            NullLogger<OrderService>.Instance);

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("debe_fabricar")]
    public async Task QueueAction_WhenManufacturingStatusIsDebeFabricarOrNullOrEmpty_SetsPorFabricar(string? initialMfgStatus)
    {
        var product = new OrderProduct
        {
            Id = "prod-1",
            Name = "Mueble Test",
            LocationStatus = "FABRICACION",
            ManufacturingStatus = initialMfgStatus,
            LogisticStatus = "Validado"
        };
        var order = new Order
        {
            Id = "507f1f77bcf86cd799439011",
            OrderNumber = "ORD-2073",
            Products = new List<OrderProduct> { product }
        };

        var service = BuildService(order);

        var request = new BulkUpdateProductStatusRequestDto
        {
            Action = "queue",
            ProviderId = "prov-1",
            ProviderName = "Carpintería Central",
            Notes = "Urgente",
            Items = new List<BulkUpdateProductStatusItemDto>
            {
                new() { OrderId = order.Id, ProductId = product.Id }
            }
        };

        var response = await service.BulkUpdateProductStatusAsync(request, "user-1", "Admin");

        Assert.Equal(1, response.SuccessCount);
        Assert.Equal(0, response.ErrorCount);
        Assert.Equal("por_fabricar", product.ManufacturingStatus);
        Assert.Equal("FABRICACION", product.LocationStatus);
        Assert.Equal("prov-1", product.ManufacturingProviderId);
        Assert.Equal("Carpintería Central", product.ManufacturingProviderName);
        Assert.Equal("Urgente", product.ManufacturingNotes);
        Assert.Equal("no_disponible", product.AvailabilityStatus);
    }

    [Fact]
    public async Task ToManufacturingAction_SetsLocationStatusToFabricacionAndManufacturingStatusToDebeFabricar()
    {
        var product = new OrderProduct
        {
            Id = "prod-1",
            Name = "Silla Comedor",
            LocationStatus = "EN TIENDA",
            ManufacturingStatus = "fabricando",
            ManufacturingProviderId = "prov-1",
            ManufacturingProviderName = "Carpintería Central",
            LogisticStatus = "Fabricándose"
        };
        var order = new Order
        {
            Id = "507f1f77bcf86cd799439011",
            OrderNumber = "ORD-2078",
            Products = new List<OrderProduct> { product }
        };

        var service = BuildService(order);

        var request = new BulkUpdateProductStatusRequestDto
        {
            Action = "to_manufacturing",
            Items = new List<BulkUpdateProductStatusItemDto>
            {
                new() { OrderId = order.Id, ProductId = product.Id }
            }
        };

        var response = await service.BulkUpdateProductStatusAsync(request, "user-1", "Admin");

        Assert.Equal(1, response.SuccessCount);
        Assert.Equal(0, response.ErrorCount);
        Assert.Equal("FABRICACION", product.LocationStatus);
        Assert.Equal("debe_fabricar", product.ManufacturingStatus);
        Assert.Equal("Validado", order.Status);
        Assert.Null(product.ManufacturingProviderId);
        Assert.Null(product.ManufacturingProviderName);
        Assert.Null(product.ManufacturingStartedAt);
        Assert.Null(product.ManufacturingCompletedAt);
    }

    [Fact]
    public async Task StartAction_SetsFabricandoAndPreservesLocationStatus()
    {
        var product = new OrderProduct
        {
            Id = "prod-1",
            Name = "Mesa Centro",
            LocationStatus = "FABRICACION",
            ManufacturingStatus = "por_fabricar",
            ManufacturingProviderId = "prov-1",
            ManufacturingProviderName = "Carpintería Central",
            LogisticStatus = "Validado"
        };
        var order = new Order
        {
            Id = "507f1f77bcf86cd799439011",
            OrderNumber = "ORD-2079",
            Products = new List<OrderProduct> { product }
        };

        var service = BuildService(order);

        var request = new BulkUpdateProductStatusRequestDto
        {
            Action = "start",
            Items = new List<BulkUpdateProductStatusItemDto>
            {
                new() { OrderId = order.Id, ProductId = product.Id }
            }
        };

        var response = await service.BulkUpdateProductStatusAsync(request, "user-1", "Admin");

        Assert.Equal(1, response.SuccessCount);
        Assert.Equal("fabricando", product.ManufacturingStatus);
        Assert.Equal("FABRICACION", product.LocationStatus);
        Assert.Equal("Fabricándose", product.LogisticStatus);
    }

    [Fact]
    public async Task MarkFabricatedAction_SetsAlmacenNoFabricadoAndPreservesLocationStatus()
    {
        var product = new OrderProduct
        {
            Id = "prod-1",
            Name = "Sofá 3 Puestos",
            LocationStatus = "FABRICACION",
            ManufacturingStatus = "fabricando",
            LogisticStatus = "Fabricándose"
        };
        var order = new Order
        {
            Id = "507f1f77bcf86cd799439011",
            OrderNumber = "ORD-2080",
            Products = new List<OrderProduct> { product }
        };

        var service = BuildService(order);

        var request = new BulkUpdateProductStatusRequestDto
        {
            Action = "mark_fabricated",
            Items = new List<BulkUpdateProductStatusItemDto>
            {
                new() { OrderId = order.Id, ProductId = product.Id }
            }
        };

        var response = await service.BulkUpdateProductStatusAsync(request, "user-1", "Admin");

        Assert.Equal(1, response.SuccessCount);
        Assert.Equal("almacen_no_fabricado", product.ManufacturingStatus);
        Assert.Equal("FABRICACION", product.LocationStatus);
        Assert.Equal("En Almacén", product.LogisticStatus);
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
            IReadOnlyCollection<string>? onlineSellerTeamIds = null,
            CancellationToken cancellationToken = default)
        {
            IEnumerable<Order> items = stored == null ? Array.Empty<Order>() : new[] { stored };
            return Task.FromResult((items, stored == null ? 0 : 1));
        }

        public Task<(IEnumerable<Order> Orders, int TotalCount)> GetFilteredPagedAsync(
            int page,
            int pageSize,
            OrderListFilter listFilter,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null,
            CancellationToken cancellationToken = default)
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

        public Task<int> GetFilteredCountAsync(
            OrderListFilter listFilter,
            IReadOnlyCollection<string>? onlineSellerTeamIds = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(stored == null ? 0 : 1);

        public Task<int> GetCountAsync(
            IReadOnlyCollection<string>? onlineSellerTeamIds = null,
            DateTime? since = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(stored == null ? 0 : 1);

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

    private sealed class FakeOnlineSellerVisibilityService : IOnlineSellerVisibilityService
    {
        public Task<IReadOnlySet<string>> GetOnlineSellerUserIdsAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlySet<string>>(new HashSet<string>());

        public Task<IReadOnlyCollection<string>?> ResolveTeamFilterIdsAsync(
            string? callerRole,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyCollection<string>?>(null);
    }
}
