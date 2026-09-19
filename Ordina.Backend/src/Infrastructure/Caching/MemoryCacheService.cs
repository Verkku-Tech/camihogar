using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;
using Ordina.Application.Common;

namespace Ordina.Infrastructure.Caching;

public class MemoryCacheService : ICacheService
{
    private readonly IMemoryCache _memoryCache;
    private readonly ConcurrentDictionary<string, byte> _keys = new();

    public MemoryCacheService(IMemoryCache memoryCache)
    {
        _memoryCache = memoryCache;
    }

    public Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        if (_memoryCache.TryGetValue(key, out T? value))
        {
            return Task.FromResult(value);
        }
        return Task.FromResult<T?>(default);
    }

    public Task SetAsync<T>(
        string key,
        T value,
        TimeSpan? slidingExpiration = null,
        TimeSpan? absoluteExpiration = null,
        CancellationToken cancellationToken = default)
    {
        var options = new MemoryCacheEntryOptions();

        if (slidingExpiration.HasValue)
            options.SetSlidingExpiration(slidingExpiration.Value);

        if (absoluteExpiration.HasValue)
            options.SetAbsoluteExpiration(absoluteExpiration.Value);
        else if (!slidingExpiration.HasValue)
            options.SetSlidingExpiration(TimeSpan.FromMinutes(10)); // Default fallback

        options.RegisterPostEvictionCallback((k, _, _, _) => _keys.TryRemove(k.ToString()!, out _));

        _memoryCache.Set(key, value, options);
        _keys.TryAdd(key, 0);

        return Task.CompletedTask;
    }

    public Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        _memoryCache.Remove(key);
        _keys.TryRemove(key, out _);
        return Task.CompletedTask;
    }

    public Task RemoveByPrefixAsync(string prefix, CancellationToken cancellationToken = default)
    {
        var matchingKeys = _keys.Keys.Where(k => k.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)).ToList();
        foreach (var key in matchingKeys)
        {
            _memoryCache.Remove(key);
            _keys.TryRemove(key, out _);
        }
        return Task.CompletedTask;
    }
}
