using Ordina.Domain.Catalog;
using Ordina.Domain.Common;
using Ordina.Domain.Finance;
using Ordina.Domain.Orders;
using Ordina.Domain.Security;
using Ordina.Domain.Stores;
using Ordina.Domain.Users;

namespace Ordina.Application.Common;

public record OrderQueryFilter(
    string? Type = null,
    string? Status = null,
    string? SaleType = null,
    string? ExcludeStatuses = null,
    string? ProductFilterPreset = null,
    string? LocationStatus = null,
    string? ManufacturingStatus = null,
    string? Vendor = null,
    string? ClientSearch = null,
    string? ClientId = null,
    DateTime? DateFrom = null,
    DateTime? DateTo = null,
    bool? IncludeBudgets = null,
    string? SearchTerm = null,
    bool IncludeImages = false);

public interface IOrderRepository : IRepository<Order>
{
    Task<Order?> GetByOrderNumberAsync(string orderNumber, CancellationToken cancellationToken = default);
    Task<string> GenerateOrderNumberAsync(string prefix, CancellationToken cancellationToken = default);
    Task<PagedResult<Order>> GetFilteredPagedAsync(int page, int pageSize, OrderQueryFilter queryFilter, CancellationToken cancellationToken = default);
}

public interface IUserRepository : IRepository<User>
{
    Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<User?> GetByUsernameAsync(string username, CancellationToken cancellationToken = default);
}

public interface IClientRepository : IRepository<Client>
{
    Task<Client?> GetByRutAsync(string rutId, CancellationToken cancellationToken = default);
}

public interface IProductRepository : IRepository<Product>
{
    Task<Product?> GetBySkuAsync(string sku, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Product>> GetByCategoryIdAsync(string categoryId, CancellationToken cancellationToken = default);
}

public interface IExchangeRateRepository : IRepository<ExchangeRate>
{
    Task<ExchangeRate?> GetLatestRateAsync(string fromCurrency, string toCurrency, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ExchangeRate>> GetActiveRatesAsync(CancellationToken cancellationToken = default);
    Task DeactivatePreviousRatesAsync(string fromCurrency, string toCurrency, CancellationToken cancellationToken = default);
}

public interface IRefreshTokenRepository : IRepository<RefreshToken>
{
    Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default);
    Task RevokeByUserIdAsync(string userId, CancellationToken cancellationToken = default);
}

public interface IIdempotencyRepository
{
    Task<IdempotencyRecord?> GetByMutationIdAsync(string mutationId, CancellationToken cancellationToken = default);
    Task SaveAsync(IdempotencyRecord record, CancellationToken cancellationToken = default);
}

public interface IOrderAuditLogRepository : IRepository<OrderAuditLog>
{
    Task<PagedResult<OrderAuditLog>> GetPagedLogsAsync(
        int page,
        int pageSize,
        string? userId = null,
        string? orderNumber = null,
        string? action = null,
        DateTime? fromUtc = null,
        DateTime? toUtc = null,
        bool sortAscending = false,
        CancellationToken cancellationToken = default);
}

