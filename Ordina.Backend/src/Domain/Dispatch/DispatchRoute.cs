using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;
using Ordina.Domain.Enums;

namespace Ordina.Domain.Dispatch;

public class DispatchItem
{
    [BsonElement("orderId")]
    public string OrderId { get; set; } = string.Empty;

    [BsonElement("orderNumber")]
    public string OrderNumber { get; set; } = string.Empty;

    [BsonElement("productLineId")]
    public string ProductLineId { get; set; } = string.Empty;

    [BsonElement("productName")]
    public string ProductName { get; set; } = string.Empty;

    [BsonElement("quantity")]
    public int Quantity { get; set; }

    [BsonElement("clientName")]
    public string ClientName { get; set; } = string.Empty;

    [BsonElement("clientPhone")]
    public string ClientPhone { get; set; } = string.Empty;

    [BsonElement("deliveryAddress")]
    public string DeliveryAddress { get; set; } = string.Empty;

    [BsonElement("status")]
    public string StatusString { get; set; } = "EN RUTA";

    [BsonIgnore]
    public LocationStatus Status
    {
        get => LocationStatusExtensions.ParseLocationStatus(StatusString);
        set => StatusString = value.ToDbString();
    }

    [BsonElement("deliveredAt")]
    public DateTime? DeliveredAt { get; set; }
}

public class DispatchRoute : BaseEntity
{
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("driverName")]
    public string DriverName { get; set; } = string.Empty;

    [BsonElement("driverPhone")]
    public string? DriverPhone { get; set; }

    [BsonElement("vehiclePlate")]
    public string? VehiclePlate { get; set; }

    [BsonElement("routeDate")]
    public DateTime RouteDate { get; set; } = DateTime.UtcNow;

    [BsonElement("zone")]
    public string Zone { get; set; } = string.Empty;

    [BsonElement("status")]
    public string StatusString { get; set; } = "Generado";

    [BsonIgnore]
    public LogisticStatus Status
    {
        get => LogisticStatusExtensions.ParseLogisticStatus(StatusString);
        set => StatusString = value.ToDbString();
    }

    [BsonElement("items")]
    public List<DispatchItem> Items { get; set; } = new();

    [BsonElement("observations")]
    public string? Observations { get; set; }
}
