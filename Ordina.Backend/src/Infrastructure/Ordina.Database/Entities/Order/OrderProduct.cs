using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Order;

public class OrderProduct
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("price")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Price { get; set; }

    [BsonElement("quantity")]
    public int Quantity { get; set; }

    [BsonElement("total")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Total { get; set; }

    [BsonElement("category")]
    public string Category { get; set; } = string.Empty;

    [BsonElement("stock")]
    public int Stock { get; set; } // Stock disponible al momento del pedido

    [BsonElement("attributes")]
    public Dictionary<string, object>? Attributes { get; set; }

    [BsonElement("discount")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal? Discount { get; set; } // Descuento aplicado al producto (monto)

    [BsonElement("observations")]
    public string? Observations { get; set; } // Observaciones específicas del producto
}
