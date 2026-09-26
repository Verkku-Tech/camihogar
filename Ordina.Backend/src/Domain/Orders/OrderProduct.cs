using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Enums;

namespace Ordina.Domain.Orders;

public class OrderProduct
{
    [BsonId]
    [BsonSerializer(typeof(Ordina.Domain.Common.FlexibleObjectIdOrStringSerializer))]
    public string Id { get; set; } = string.Empty;

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("price")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Price { get; set; }

    [BsonElement("priceCurrency")]
    public string? PriceCurrency { get; set; } = "USD";

    [BsonElement("quantity")]
    public int Quantity { get; set; }

    [BsonElement("total")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Total { get; set; }

    [BsonElement("category")]
    public string Category { get; set; } = string.Empty;

    [BsonElement("stock")]
    public int Stock { get; set; }

    [BsonElement("attributes")]
    public Dictionary<string, object>? Attributes { get; set; }

    [BsonElement("discount")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal? Discount { get; set; }

    [BsonElement("observations")]
    public string? Observations { get; set; }

    // Fabricación
    [BsonElement("availabilityStatus")]
    public string? AvailabilityStatusString { get; set; }

    [BsonIgnore]
    public AvailabilityStatus? AvailabilityStatus
    {
        get => AvailabilityStatusString != null ? AvailabilityStatusExtensions.ParseAvailabilityStatus(AvailabilityStatusString) : null;
        set => AvailabilityStatusString = value?.ToDbString();
    }

    [BsonElement("manufacturingStatus")]
    public string? ManufacturingStatusString { get; set; }

    [BsonIgnore]
    public ManufacturingStage? ManufacturingStatus
    {
        get => ManufacturingStatusString != null ? ManufacturingStageExtensions.ParseManufacturingStage(ManufacturingStatusString) : null;
        set => ManufacturingStatusString = value?.ToDbString();
    }

    [BsonElement("manufacturingProviderId")]
    public string? ManufacturingProviderId { get; set; }

    [BsonElement("manufacturingProviderName")]
    public string? ManufacturingProviderName { get; set; }

    [BsonElement("manufacturingStartedAt")]
    public DateTime? ManufacturingStartedAt { get; set; }

    [BsonElement("manufacturingCompletedAt")]
    public DateTime? ManufacturingCompletedAt { get; set; }

    [BsonElement("manufacturingNotes")]
    public string? ManufacturingNotes { get; set; }

    // Refabricación
    [BsonElement("refabricationReason")]
    public string? RefabricationReason { get; set; }

    [BsonElement("refabricatedAt")]
    public DateTime? RefabricatedAt { get; set; }

    [BsonElement("refabricationHistory")]
    public List<RefabricationRecord>? RefabricationHistory { get; set; }

    // Logística y Ubicación
    [BsonElement("locationStatus")]
    public string? LocationStatusString { get; set; }

    [BsonIgnore]
    public LocationStatus LocationStatus
    {
        get => LocationStatusExtensions.ParseLocationStatus(LocationStatusString);
        set => LocationStatusString = value.ToDbString();
    }

    [BsonElement("dispatchOrigin")]
    public string? DispatchOrigin { get; set; }

    [BsonElement("logisticStatus")]
    public string LogisticStatusString { get; set; } = "Generado";

    [BsonIgnore]
    public LogisticStatus LogisticStatus
    {
        get => LogisticStatusExtensions.ParseLogisticStatus(LogisticStatusString);
        set => LogisticStatusString = value.ToDbString();
    }

    [BsonElement("deliveredAt")]
    public DateTime? DeliveredAt { get; set; }

    // Sobreprecio
    [BsonElement("surchargeEnabled")]
    public bool? SurchargeEnabled { get; set; }

    [BsonElement("surchargeAmount")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal? SurchargeAmount { get; set; }

    [BsonElement("surchargeReason")]
    public string? SurchargeReason { get; set; }

    [BsonElement("images")]
    public List<ProductImage>? Images { get; set; }

    [BsonElement("commissionLineSource")]
    public string? CommissionLineSource { get; set; }

    [BsonElement("catalogProductId")]
    public string? CatalogProductId { get; set; }
}
