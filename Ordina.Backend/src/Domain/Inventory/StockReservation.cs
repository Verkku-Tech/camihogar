using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Inventory;

public class StockReservation : BaseEntity
{
    [BsonElement("stockId")]
    public string StockId { get; set; } = string.Empty;

    [BsonElement("productId")]
    public string ProductId { get; set; } = string.Empty;

    [BsonElement("productName")]
    public string ProductName { get; set; } = string.Empty;

    [BsonElement("locationId")]
    public string LocationId { get; set; } = string.Empty;

    [BsonElement("locationName")]
    public string LocationName { get; set; } = string.Empty;

    [BsonElement("vendorId")]
    public string VendorId { get; set; } = string.Empty;

    [BsonElement("vendorName")]
    public string VendorName { get; set; } = string.Empty;

    [BsonElement("quantity")]
    public int Quantity { get; set; } = 1;

    [BsonElement("reservationType")]
    public string ReservationType { get; set; } = "counter"; // "counter" (10m) | "formal" (30m)

    [BsonElement("orderNumber")]
    public string? OrderNumber { get; set; }

    [BsonElement("expiresAt")]
    public DateTime ExpiresAt { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = "active"; // "active" | "released" | "converted"
}
