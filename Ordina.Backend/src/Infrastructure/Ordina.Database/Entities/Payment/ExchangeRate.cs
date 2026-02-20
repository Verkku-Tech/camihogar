using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System;

namespace Ordina.Database.Entities.Payment
{
    public class ExchangeRate
    {
        [BsonId]
        [BsonRepresentation(BsonType.String)]
        public Guid Id { get; set; }

        [BsonElement("fromCurrency")]
        public string FromCurrency { get; set; } = "Bs";

        [BsonElement("toCurrency")]
        public string ToCurrency { get; set; } // USD, EUR

        [BsonElement("rate")]
        public decimal Rate { get; set; }

        [BsonElement("effectiveDate")]
        public DateTime EffectiveDate { get; set; }

        [BsonElement("isActive")]
        public bool IsActive { get; set; }

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
