using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;
using Ordina.Domain.Enums;

namespace Ordina.Domain.Finance;

public class Payment : BaseEntity
{
    [BsonElement("orderId")]
    public string OrderId { get; set; } = string.Empty;

    [BsonElement("amount")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Amount { get; set; }

    [BsonElement("currency")]
    public string Currency { get; set; } = "USD";

    [BsonElement("status")]
    public string StatusString { get; set; } = "Pending";

    [BsonIgnore]
    public PaymentStatus Status
    {
        get => PaymentStatusExtensions.ParsePaymentStatus(StatusString);
        set => StatusString = value.ToDbString();
    }

    [BsonElement("transactionId")]
    public string? TransactionId { get; set; }

    [BsonElement("paymentMethodId")]
    public string PaymentMethodId { get; set; } = string.Empty;
}
