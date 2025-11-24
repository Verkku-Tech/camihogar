using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Order;

public class PartialPayment
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("amount")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Amount { get; set; }

    [BsonElement("method")]
    public string Method { get; set; } = string.Empty;

    [BsonElement("date")]
    public DateTime Date { get; set; }

    [BsonElement("paymentDetails")]
    public PaymentDetails? PaymentDetails { get; set; }
}
