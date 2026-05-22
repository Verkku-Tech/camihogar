using Ordina.Database.Entities.AccessPin;

namespace Ordina.Database.Repositories;

public interface IAccessPinRepository
{
    Task<AccessPin> CreateAsync(AccessPin accessPin);

    Task<AccessPin?> GetActiveByPinAsync(string pin);

    Task<AccessPin?> GetActiveSessionAsync(string orderId, string userId);

    Task MarkAsUsedAsync(
        string id,
        string usedByUserId,
        string orderId,
        DateTime usedAt,
        DateTime sessionExpiresAt);

    Task ExpireStaleActivePinsAsync(DateTime nowUtc);

    Task<(IReadOnlyList<AccessPin> Items, long TotalCount)> GetPagedHistoryAsync(int page, int pageSize);
}
