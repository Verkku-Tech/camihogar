namespace Ordina.Orders.Application.OnlineSeller;

public interface IOnlineSellerVisibilityService
{
    /// <summary>
    /// IDs de usuarios con rol Online Seller (activos e inactivos), cacheados.
    /// </summary>
    Task<IReadOnlySet<string>> GetOnlineSellerUserIdsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Si el caller es Online Seller, devuelve el set de IDs para filtrar; si no, null (sin filtro).
    /// </summary>
    Task<IReadOnlyCollection<string>?> ResolveTeamFilterIdsAsync(
        string? callerRole,
        CancellationToken cancellationToken = default);
}
