using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Inventory;

public class PhysicalStock : BaseEntity
{
    [BsonElement("productId")]
    public string ProductId { get; set; } = string.Empty;

    [BsonElement("productName")]
    public string ProductName { get; set; } = string.Empty;

    [BsonElement("sku")]
    public string Sku { get; set; } = string.Empty;

    [BsonElement("categoryId")]
    public string CategoryId { get; set; } = string.Empty;

    [BsonElement("categoryName")]
    public string CategoryName { get; set; } = string.Empty;

    [BsonElement("locationType")]
    public string LocationType { get; set; } = "store"; // "store" | "warehouse"

    [BsonElement("locationId")]
    public string LocationId { get; set; } = string.Empty;

    [BsonElement("locationName")]
    public string LocationName { get; set; } = string.Empty;

    [BsonElement("attributes")]
    public Dictionary<string, string> Attributes { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    [BsonElement("variantKey")]
    public string VariantKey { get; set; } = string.Empty;

    [BsonElement("quantity")]
    public int Quantity { get; set; } = 0;

    [BsonElement("reservedQuantity")]
    public int ReservedQuantity { get; set; } = 0;

    [BsonIgnore]
    public int AvailableQuantity => Math.Max(0, Quantity - ReservedQuantity);

    [BsonElement("priceUsd")]
    public decimal PriceUsd { get; set; } = 0m;

    [BsonElement("costUsd")]
    public decimal CostUsd { get; set; } = 0m;

    public static string BuildVariantKey(Dictionary<string, string>? attrs)
    {
        if (attrs == null || attrs.Count == 0) return "standard";
        return string.Join("|", attrs.OrderBy(kv => kv.Key).Select(kv => $"{kv.Key.Trim().ToLowerInvariant()}:{kv.Value.Trim().ToLowerInvariant()}"));
    }
}
