using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Domain.Orders;

public class DeliveryServices
{
    [BsonElement("deliveryExpress")]
    public DeliveryService? DeliveryExpress { get; set; }

    [BsonElement("servicioAcarreo")]
    public DeliveryService? ServicioAcarreo { get; set; }

    [BsonElement("servicioArmado")]
    public DeliveryService? ServicioArmado { get; set; }
}

public class DeliveryService
{
    [BsonElement("enabled")]
    public bool Enabled { get; set; }

    [BsonElement("cost")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal? Cost { get; set; }

    [BsonElement("currency")]
    public string Currency { get; set; } = "USD";
}
