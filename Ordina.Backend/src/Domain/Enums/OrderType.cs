namespace Ordina.Domain.Enums;

public enum OrderType
{
    Order,
    Budget,
    Reservation
}

public static class OrderTypeExtensions
{
    public static string ToDbString(this OrderType type) => type switch
    {
        OrderType.Order => "Order",
        OrderType.Budget => "Budget",
        OrderType.Reservation => "Reservation",
        _ => "Order"
    };

    public static OrderType ParseOrderType(string? value) => (value?.Trim().ToLowerInvariant()) switch
    {
        "budget" or "presupuesto" => OrderType.Budget,
        "reservation" or "reserva" => OrderType.Reservation,
        _ => OrderType.Order
    };
}
