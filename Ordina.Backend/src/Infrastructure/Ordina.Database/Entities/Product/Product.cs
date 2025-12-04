using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Product;

public class Product
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("categoryId")]
    public string CategoryId { get; set; } = string.Empty;

    [BsonElement("category")]
    public string Category { get; set; } = string.Empty; // Nombre de la categoría para compatibilidad con frontend

    [BsonElement("price")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Price { get; set; }

    [BsonElement("priceCurrency")]
    public string? PriceCurrency { get; set; } // "Bs", "USD", "EUR"

    [BsonElement("stock")]
    public int Stock { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = "active"; // "active", "inactive", "out_of_stock", etc.

    [BsonElement("sku")]
    public string SKU { get; set; } = string.Empty;

    [BsonElement("attributes")]
    public Dictionary<string, object>? Attributes { get; set; }

    [BsonElement("providerId")]
    public string? ProviderId { get; set; } // Opcional

    [BsonElement("description")]
    public string? Description { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime? UpdatedAt { get; set; }
}
