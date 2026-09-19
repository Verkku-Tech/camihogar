using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Domain.Enums;

public enum OrderStatus
{
    Pending,
    Reserved,
    Completed,
    Cancelled
}

public static class OrderStatusExtensions
{
    public static string ToDbString(this OrderStatus status) => status switch
    {
        OrderStatus.Pending => "Pendiente",
        OrderStatus.Reserved => "Apartado",
        OrderStatus.Completed => "Completado",
        OrderStatus.Cancelled => "Cancelado",
        _ => "Pendiente"
    };

    public static OrderStatus ParseOrderStatus(string? value) => (value?.Trim().ToLowerInvariant()) switch
    {
        "pendiente" or "pending" => OrderStatus.Pending,
        "apartado" or "reserved" => OrderStatus.Reserved,
        "completado" or "completed" => OrderStatus.Completed,
        "cancelado" or "cancelled" => OrderStatus.Cancelled,
        _ => OrderStatus.Pending
    };
}
