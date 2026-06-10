using Microsoft.Extensions.Caching.Memory;
using Ordina.Database.Repositories;

namespace Ordina.Orders.Application.OnlineSeller;

public class OnlineSellerVisibilityService : IOnlineSellerVisibilityService
{
    private const string CacheKey = "online_seller_user_ids";
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    private readonly IUserRepository _userRepository;
    private readonly IMemoryCache _memoryCache;

    public OnlineSellerVisibilityService(IUserRepository userRepository, IMemoryCache memoryCache)
    {
        _userRepository = userRepository;
        _memoryCache = memoryCache;
    }

    public async Task<IReadOnlySet<string>> GetOnlineSellerUserIdsAsync(
        CancellationToken cancellationToken = default)
    {
        if (_memoryCache.TryGetValue(CacheKey, out IReadOnlySet<string>? cached) && cached != null)
            return cached;

        var users = await _userRepository.GetAllAsync();
        var ids = users
            .Where(u => OrderOnlineSellerVisibility.IsOnlineSellerRole(u.Role))
            .Select(u => u.Id.Trim())
            .Where(id => id.Length > 0)
            .ToHashSet(StringComparer.Ordinal);

        _memoryCache.Set(CacheKey, ids, CacheTtl);
        return ids;
    }

    public async Task<IReadOnlyCollection<string>?> ResolveTeamFilterIdsAsync(
        string? callerRole,
        CancellationToken cancellationToken = default)
    {
        if (!OrderOnlineSellerVisibility.IsOnlineSellerRole(callerRole))
            return null;

        var ids = await GetOnlineSellerUserIdsAsync(cancellationToken);
        return ids.Count == 0 ? Array.Empty<string>() : ids.ToList();
    }
}
