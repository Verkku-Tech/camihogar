using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Category;

public class Category
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("description")]
    public string Description { get; set; } = string.Empty;

    [BsonElement("products")]
    public int Products { get; set; } // Calculado - número de productos en esta categoría

    [BsonElement("maxDiscount")]
    public decimal MaxDiscount { get; set; }

    [BsonElement("maxDiscountCurrency")]
    public string? MaxDiscountCurrency { get; set; } // "Bs", "USD", "EUR"

    [BsonElement("attributes")]
    public List<CategoryAttribute> Attributes { get; set; } = new();

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime? UpdatedAt { get; set; }
}
