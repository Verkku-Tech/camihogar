using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Manufacturing;

public class ManufacturingOrder : BaseEntity
{
    [BsonElement("orderNumber")]
    public string OrderNumber { get; set; } = string.Empty;

    [BsonElement("orderType")]
    public string OrderType { get; set; } = "StockReplenishment";

    [BsonElement("productId")]
    public string ProductId { get; set; } = string.Empty;

    [BsonElement("productName")]
    public string ProductName { get; set; } = string.Empty;

    [BsonElement("sku")]
    public string Sku { get; set; } = string.Empty;

    [BsonElement("attributes")]
    public Dictionary<string, string> Attributes { get; set; } = new();

    [BsonElement("quantity")]
    public int Quantity { get; set; }

    [BsonElement("destinationLocationId")]
    public string DestinationLocationId { get; set; } = string.Empty;

    [BsonElement("destinationLocationName")]
    public string DestinationLocationName { get; set; } = string.Empty;

    [BsonElement("destinationLocationType")]
    public string DestinationLocationType { get; set; } = string.Empty;

    [BsonElement("requestedBy")]
    public string RequestedBy { get; set; } = string.Empty;

    [BsonElement("providerId")]
    public string? ProviderId { get; set; }

    [BsonElement("providerName")]
    public string? ProviderName { get; set; }

    [BsonElement("costUsd")]
    public decimal CostUsd { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = "Pendiente";

    [BsonElement("notes")]
    public string? Notes { get; set; }

    [BsonElement("startedAt")]
    public DateTime? StartedAt { get; set; }

    [BsonElement("completedAt")]
    public DateTime? CompletedAt { get; set; }
}
