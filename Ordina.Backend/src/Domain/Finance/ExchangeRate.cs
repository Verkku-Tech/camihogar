using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Finance;

public class ExchangeRate : BaseEntity
{
    [BsonElement("fromCurrency")]
    public string FromCurrency { get; set; } = "Bs";

    [BsonElement("toCurrency")]
    public string ToCurrency { get; set; } = "USD";

    [BsonElement("rate")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Rate { get; set; }

    [BsonElement("effectiveDate")]
    public DateTime EffectiveDate { get; set; } = DateTime.UtcNow;

    [BsonElement("isActive")]
    public bool IsActive { get; set; } = true;
}
