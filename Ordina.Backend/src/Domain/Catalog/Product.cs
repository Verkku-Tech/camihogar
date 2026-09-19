using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;
using Ordina.Domain.Enums;

namespace Ordina.Domain.Catalog;

public class Product : BaseEntity
{
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("categoryId")]
    public string CategoryId { get; set; } = string.Empty;

    [BsonElement("category")]
    public string Category { get; set; } = string.Empty;

    [BsonElement("price")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Price { get; set; }

    [BsonElement("priceCurrency")]
    public string? PriceCurrency { get; set; } = "USD";

    [BsonElement("stock")]
    public int Stock { get; set; }

    [BsonElement("status")]
    public string StatusString { get; set; } = "active";

    [BsonIgnore]
    public ProductStatus Status
    {
        get => ProductStatusExtensions.ParseProductStatus(StatusString);
        set => StatusString = value.ToDbString();
    }

    [BsonElement("sku")]
    public string SKU { get; set; } = string.Empty;

    [BsonElement("attributes")]
    public Dictionary<string, object>? Attributes { get; set; }

    [BsonElement("providerId")]
    public string? ProviderId { get; set; }

    [BsonElement("description")]
    public string? Description { get; set; }
}
