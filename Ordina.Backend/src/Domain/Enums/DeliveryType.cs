namespace Ordina.Domain.Enums;

public enum DeliveryType
{
    ScheduledDelivery, // entrega_programada
    ExpressDelivery,   // delivery_express
    StorePickup,       // retiro_tienda
    WarehousePickup    // retiro_almacen
}

public static class DeliveryTypeExtensions
{
    public static string ToDbString(this DeliveryType type) => type switch
    {
        DeliveryType.ScheduledDelivery => "entrega_programada",
        DeliveryType.ExpressDelivery => "delivery_express",
        DeliveryType.StorePickup => "retiro_tienda",
        DeliveryType.WarehousePickup => "retiro_almacen",
        _ => "entrega_programada"
    };

    public static DeliveryType ParseDeliveryType(string? value) => (value?.Trim().ToLowerInvariant()) switch
    {
        "delivery_express" or "express" => DeliveryType.ExpressDelivery,
        "retiro_tienda" or "storepickup" => DeliveryType.StorePickup,
        "retiro_almacen" or "warehousepickup" => DeliveryType.WarehousePickup,
        _ => DeliveryType.ScheduledDelivery
    };
}
