using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;
using Ordina.Domain.Enums;
using Ordina.Domain.Orders;

namespace Ordina.Domain.Manufacturing;

public class WorkOrder : BaseEntity
{
    [BsonElement("orderId")]
    public string OrderId { get; set; } = string.Empty;

    [BsonElement("orderNumber")]
    public string OrderNumber { get; set; } = string.Empty;

    [BsonElement("productId")]
    public string ProductId { get; set; } = string.Empty;

    [BsonElement("productName")]
    public string ProductName { get; set; } = string.Empty;

    [BsonElement("quantity")]
    public int Quantity { get; set; }

    [BsonElement("category")]
    public string Category { get; set; } = string.Empty;

    [BsonElement("attributes")]
    public Dictionary<string, object>? Attributes { get; set; }

    [BsonElement("stage")]
    public string StageString { get; set; } = "debe_fabricar";

    [BsonIgnore]
    public ManufacturingStage Stage
    {
        get => ManufacturingStageExtensions.ParseManufacturingStage(StageString);
        set => StageString = value.ToDbString();
    }

    [BsonElement("providerId")]
    public string? ProviderId { get; set; }

    [BsonElement("providerName")]
    public string? ProviderName { get; set; }

    [BsonElement("startedAt")]
    public DateTime? StartedAt { get; set; }

    [BsonElement("completedAt")]
    public DateTime? CompletedAt { get; set; }

    [BsonElement("notes")]
    public string? Notes { get; set; }

    [BsonElement("refabricationHistory")]
    public List<RefabricationRecord>? RefabricationHistory { get; set; }
}
