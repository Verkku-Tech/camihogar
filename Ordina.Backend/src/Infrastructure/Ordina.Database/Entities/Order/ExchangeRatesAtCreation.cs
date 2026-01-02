using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Order;

public class ExchangeRatesAtCreation
{
    [BsonElement("usd")]
    public ExchangeRateInfo? Usd { get; set; }

    [BsonElement("eur")]
    public ExchangeRateInfo? Eur { get; set; }
}

public class ExchangeRateInfo
{
    [BsonElement("rate")]
    [BsonRepresentation(MongoDB.Bson.BsonType.Decimal128)]
    public decimal Rate { get; set; }

    [BsonElement("effectiveDate")]
    public string EffectiveDate { get; set; } = string.Empty;
}

