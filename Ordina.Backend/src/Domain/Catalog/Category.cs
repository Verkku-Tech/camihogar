using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Catalog;

public class Category : BaseEntity
{
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("description")]
    public string Description { get; set; } = string.Empty;

    [BsonElement("products")]
    public int Products { get; set; }

    [BsonElement("maxDiscount")]
    public decimal MaxDiscount { get; set; }

    [BsonElement("maxDiscountCurrency")]
    public string? MaxDiscountCurrency { get; set; } = "USD";

    [BsonElement("attributes")]
    public List<CategoryAttribute> Attributes { get; set; } = new();
}
