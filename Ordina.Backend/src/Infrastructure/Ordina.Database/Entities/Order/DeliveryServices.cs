using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Order;

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
    [BsonRepresentation(MongoDB.Bson.BsonType.Decimal128)]
    public decimal? Cost { get; set; } // Opcional para Acarreo, obligatorio para Armado

    [BsonElement("currency")]
    public string Currency { get; set; } = "Bs"; // "Bs" | "USD" | "EUR"
}

