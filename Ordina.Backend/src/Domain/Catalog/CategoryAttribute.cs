using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Domain.Catalog;

public class CategoryAttribute
{
    [BsonElement("id")]
    public string Id { get; set; } = string.Empty;

    [BsonElement("title")]
    public string Title { get; set; } = string.Empty;

    [BsonElement("description")]
    public string Description { get; set; } = string.Empty;

    [BsonElement("valueType")]
    public string ValueType { get; set; } = string.Empty;

    [BsonElement("values")]
    public List<AttributeValue> Values { get; set; } = new();

    [BsonElement("maxSelections")]
    public int? MaxSelections { get; set; }

    [BsonElement("minValue")]
    public decimal? MinValue { get; set; }

    [BsonElement("maxValue")]
    public decimal? MaxValue { get; set; }

    [BsonElement("required")]
    public bool? Required { get; set; }
}

public class AttributeValue
{
    [BsonElement("id")]
    public string Id { get; set; } = string.Empty;

    [BsonElement("label")]
    public string Label { get; set; } = string.Empty;

    [BsonElement("isDefault")]
    public bool? IsDefault { get; set; }

    [BsonElement("priceAdjustment")]
    public decimal? PriceAdjustment { get; set; }

    [BsonElement("priceAdjustmentCurrency")]
    public string? PriceAdjustmentCurrency { get; set; }

    [BsonElement("productId")]
    public string? ProductId { get; set; }
}
