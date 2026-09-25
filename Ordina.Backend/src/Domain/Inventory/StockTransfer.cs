using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Inventory;

public class StockTransfer : BaseEntity
{
    [BsonElement("transferNumber")]
    public string TransferNumber { get; set; } = string.Empty;

    [BsonElement("stockId")]
    public string StockId { get; set; } = string.Empty;

    [BsonElement("productId")]
    public string ProductId { get; set; } = string.Empty;

    [BsonElement("productName")]
    public string ProductName { get; set; } = string.Empty;

    [BsonElement("sku")]
    public string Sku { get; set; } = string.Empty;

    [BsonElement("variantKey")]
    public string VariantKey { get; set; } = string.Empty;

    [BsonElement("attributes")]
    public Dictionary<string, string> Attributes { get; set; } = new();

    [BsonElement("originLocationId")]
    public string OriginLocationId { get; set; } = string.Empty;

    [BsonElement("originLocationName")]
    public string OriginLocationName { get; set; } = string.Empty;

    [BsonElement("originLocationType")]
    public string OriginLocationType { get; set; } = string.Empty;

    [BsonElement("destinationLocationId")]
    public string DestinationLocationId { get; set; } = string.Empty;

    [BsonElement("destinationLocationName")]
    public string DestinationLocationName { get; set; } = string.Empty;

    [BsonElement("destinationLocationType")]
    public string DestinationLocationType { get; set; } = string.Empty;

    [BsonElement("quantity")]
    public int Quantity { get; set; } = 1;

    [BsonElement("status")]
    public string Status { get; set; } = "in_transit";

    [BsonElement("requestedBy")]
    public string RequestedBy { get; set; } = string.Empty;

    [BsonElement("transferredBy")]
    public string? TransferredBy { get; set; }

    [BsonElement("reason")]
    public string? Reason { get; set; }

    [BsonElement("transferredAt")]
    public DateTime? TransferredAt { get; set; }
}

