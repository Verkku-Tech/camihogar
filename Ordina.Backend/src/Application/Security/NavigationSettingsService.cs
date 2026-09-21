using Ordina.Application.Common;
using Ordina.Domain.Common;
using Ordina.Domain.Security;

namespace Ordina.Application.Security;

public class NavigationSettingsService : INavigationSettingsService
{
    private readonly IRepository<NavigationSettings> _repository;

    public NavigationSettingsService(IRepository<NavigationSettings> repository)
    {
        _repository = repository;
    }

    public async Task<IReadOnlyList<NavigationItemSetting>> GetSettingsAsync(CancellationToken cancellationToken = default)
    {
        var all = await _repository.GetAllAsync(cancellationToken);
        var doc = all.FirstOrDefault();
        return doc?.Items ?? new List<NavigationItemSetting>();
    }

    public async Task<IReadOnlyList<NavigationItemSetting>> UpdateSettingsAsync(
        List<NavigationItemSetting> items,
        string? userRole,
        CancellationToken cancellationToken = default)
    {
        // ponytail: Super Administrator check strictly enforced before persisting navigation visibility
        var isSuperAdmin = string.Equals(userRole, "Super Administrator", StringComparison.OrdinalIgnoreCase);
        if (!isSuperAdmin)
        {
            throw new UnauthorizedAccessException("Solo el Super Administrador puede modificar la configuración de navegación.");
        }

        var all = await _repository.GetAllAsync(cancellationToken);
        var doc = all.FirstOrDefault();
        if (doc == null)
        {
            doc = new NavigationSettings { Items = items };
            await _repository.AddAsync(doc, cancellationToken);
        }
        else
        {
            doc.Items = items;
            doc.UpdatedAt = DateTime.UtcNow;
            await _repository.UpdateAsync(doc, cancellationToken);
        }

        return doc.Items;
    }
}
