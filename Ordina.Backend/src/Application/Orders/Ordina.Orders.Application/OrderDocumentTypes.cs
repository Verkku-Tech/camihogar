namespace Ordina.Orders.Application;

/// <summary>
/// Tipos de documento de pedido y valores asociados (reserva, presupuesto, pedido).
/// </summary>
public static class OrderDocumentTypes
{
    public const string Reservation = "Reservation";
    public const string ReservationStatus = "Reserva";
    public const string ReservationPrefix = "RES-";

    /// <summary>Legacy: solo lectura y migración.</summary>
    public const string LegacyReservation = "PendingConfirmation";
    public const string LegacyReservationStatus = "Por Confirmar";
    public const string LegacyReservationPrefix = "PCF-";

    public static bool IsReservationType(string? type) =>
        string.Equals(type, Reservation, StringComparison.OrdinalIgnoreCase)
        || string.Equals(type, LegacyReservation, StringComparison.OrdinalIgnoreCase);

    public static bool IsActiveReservationStatus(string? status) =>
        string.Equals(status, ReservationStatus, StringComparison.Ordinal)
        || string.Equals(status, LegacyReservationStatus, StringComparison.Ordinal);

    public static bool IsReservationOrderNumber(string? orderNumber)
    {
        if (string.IsNullOrWhiteSpace(orderNumber)) return false;
        var num = orderNumber.Trim().ToUpperInvariant();
        return num.StartsWith(ReservationPrefix, StringComparison.Ordinal)
            || num.StartsWith(LegacyReservationPrefix, StringComparison.Ordinal);
    }
}
