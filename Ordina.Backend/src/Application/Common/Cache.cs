namespace Ordina.Application.Common;

public interface ICacheService
{
    Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default);
    Task SetAsync<T>(string key, T value, TimeSpan? slidingExpiration = null, TimeSpan? absoluteExpiration = null, CancellationToken cancellationToken = default);
    Task RemoveAsync(string key, CancellationToken cancellationToken = default);
    Task RemoveByPrefixAsync(string prefix, CancellationToken cancellationToken = default);
}

public static class CacheKeys
{
    public const string Categories = "catalog:categories:all";
    public const string Products = "catalog:products:all";
    public const string ExchangeRates = "finance:exchangerates:latest";
    public const string Stores = "stores:all";
    public const string Accounts = "stores:accounts:all";

    public static string ProductById(string id) => $"catalog:product:{id}";
    public static string ProductsByCategory(string categoryId) => $"catalog:category:{categoryId}:products";
    public static string StoreById(string id) => $"stores:{id}";
}

public static class CacheTtl
{
    public static readonly TimeSpan CatalogSliding = TimeSpan.FromMinutes(10);
    public static readonly TimeSpan ExchangeRateAbsolute = TimeSpan.FromHours(1);
    public static readonly TimeSpan StoresAbsolute = TimeSpan.FromMinutes(30);
}
