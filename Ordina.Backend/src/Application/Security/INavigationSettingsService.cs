using Ordina.Domain.Security;

namespace Ordina.Application.Security;

public interface INavigationSettingsService
{
    Task<IReadOnlyList<NavigationItemSetting>> GetSettingsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<NavigationItemSetting>> UpdateSettingsAsync(List<NavigationItemSetting> items, string? userRole, CancellationToken cancellationToken = default);
}
