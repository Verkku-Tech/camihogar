namespace Ordina.Orders.Application.Commission;

public static class CommissionLineSources
{
    public const string ReservationUnchanged = "reservation_unchanged";
    public const string StoreModified = "store_modified";
    public const string StoreAdded = "store_added";
    public const string StoreSubstitution = "store_substitution";

    public static bool IsSharedSaleSource(string? source) =>
        source == StoreModified || source == StoreSubstitution;
}
