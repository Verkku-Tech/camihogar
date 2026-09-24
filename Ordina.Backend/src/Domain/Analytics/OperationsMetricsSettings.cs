using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Analytics;

public class OperationsMetricsSettings : BaseEntity
{

    [BsonElement("defaultLeadTime")]
    public LeadTimeCategoryThreshold DefaultLeadTime { get; set; } = new(5, 7, 30, 50);

    [BsonElement("categoryLeadTimes")]
    public Dictionary<string, LeadTimeCategoryThreshold> CategoryLeadTimes { get; set; } = new()
    {
        { "Cama", new(5, 7, 30, 50) },
        { "Box solo", new(3, 5, 30, 50) },
        { "Colchones", new(1, 2, 30, 50) },
        { "Mueble", new(4, 6, 30, 50) },
        { "Copete solo", new(2, 4, 30, 50) },
        { "ComboHogar", new(5, 7, 30, 50) }
    };

    [BsonElement("otif")]
    public OtifThreshold Otif { get; set; } = new(95, 90, 80);

    [BsonElement("stageMaxStandardDays")]
    public Dictionary<string, double> StageMaxStandardDays { get; set; } = new()
    {
        { "Aprobación / Pago", 2.0 },
        { "Cola Taller / Fabricación", 7.0 },
        { "Almacén Central (Terrinca)", 3.0 },
        { "Ruta y Despacho", 3.0 }
    };

    [BsonElement("fulfillment")]
    public FulfillmentThreshold Fulfillment { get; set; } = new(60, 50, 40);

    [BsonElement("lastAlertSentUtc")]
    public DateTime? LastAlertSentUtc { get; set; }
}

public record LeadTimeCategoryThreshold(
    double MinStandardDays,
    double MaxStandardDays,
    double WarningExtraPercentage = 30.0,
    double CriticalExtraPercentage = 50.0
);

public record OtifThreshold(
    double TargetPercentage = 95.0,
    double WarningPercentage = 90.0,
    double CriticalPercentage = 80.0
);

public record FulfillmentThreshold(
    double TargetImmediatePercentage = 60.0,
    double WarningImmediatePercentage = 50.0,
    double CriticalImmediatePercentage = 40.0
);
