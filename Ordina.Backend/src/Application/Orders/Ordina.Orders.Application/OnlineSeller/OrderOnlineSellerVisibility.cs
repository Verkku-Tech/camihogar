using Ordina.Database.Entities.Order;

namespace Ordina.Orders.Application.OnlineSeller;

/// <summary>
/// Reglas de visibilidad del equipo Online Seller (Opción A).
/// </summary>
public static class OrderOnlineSellerVisibility
{
    public const string OnlineSellerRole = "Online Seller";

    public static bool IsOnlineSellerRole(string? role)
    {
        if (string.IsNullOrWhiteSpace(role)) return false;
        return string.Equals(role.Trim(), OnlineSellerRole, StringComparison.Ordinal)
            || string.Equals(role.Trim(), "Vendedor Online", StringComparison.OrdinalIgnoreCase);
    }

    public static IEnumerable<string> CollectActorIds(Order order)
    {
        if (!string.IsNullOrWhiteSpace(order.VendorId))
            yield return order.VendorId.Trim();
        if (!string.IsNullOrWhiteSpace(order.ReferrerId))
            yield return order.ReferrerId.Trim();
        if (!string.IsNullOrWhiteSpace(order.SourceReservationVendorId))
            yield return order.SourceReservationVendorId.Trim();
    }

    public static bool IsVisibleToTeam(Order order, IReadOnlySet<string> onlineSellerIds)
    {
        if (onlineSellerIds.Count == 0) return false;
        return CollectActorIds(order).Any(id => onlineSellerIds.Contains(id));
    }

    public static bool IsOwnedBySeller(Order order, string userId)
    {
        if (string.IsNullOrWhiteSpace(userId)) return false;
        var uid = userId.Trim();
        if (string.Equals(order.VendorId?.Trim(), uid, StringComparison.Ordinal)) return true;
        if (!string.IsNullOrWhiteSpace(order.ReferrerId)
            && string.Equals(order.ReferrerId.Trim(), uid, StringComparison.Ordinal))
            return true;
        return false;
    }
}
