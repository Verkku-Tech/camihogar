using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Category;

public class AttributeValue
{
    [BsonElement("id")]
    public string Id { get; set; } = string.Empty;

    [BsonElement("label")]
    public string Label { get; set; } = string.Empty;

    [BsonElement("isDefault")]
    public bool? IsDefault { get; set; }

    [BsonElement("priceAdjustment")]
    public decimal? PriceAdjustment { get; set; } // positive for increase, negative for decrease

    [BsonElement("priceAdjustmentCurrency")]
    public string? PriceAdjustmentCurrency { get; set; } // "Bs", "USD", "EUR"

    [BsonElement("productId")]
    public string? ProductId { get; set; } // ID del producto cuando valueType es "Product"
}
