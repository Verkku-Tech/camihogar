using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Domain.Orders;

public class PaymentDetails
{
    // Pago Móvil
    [BsonElement("pagomovilReference")]
    public string? PagomovilReference { get; set; }

    [BsonElement("pagomovilBank")]
    public string? PagomovilBank { get; set; }

    [BsonElement("pagomovilPhone")]
    public string? PagomovilPhone { get; set; }

    [BsonElement("pagomovilDate")]
    public string? PagomovilDate { get; set; }

    // Transferencia
    [BsonElement("transferenciaBank")]
    public string? TransferenciaBank { get; set; }

    [BsonElement("transferenciaReference")]
    public string? TransferenciaReference { get; set; }

    [BsonElement("transferenciaDate")]
    public string? TransferenciaDate { get; set; }

    // Efectivo
    [BsonElement("cashAmount")]
    public string? CashAmount { get; set; }

    [BsonElement("cashCurrency")]
    public string? CashCurrency { get; set; }

    [BsonElement("cashReceived")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal? CashReceived { get; set; }

    [BsonElement("exchangeRate")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal? ExchangeRate { get; set; }

    [BsonElement("originalAmount")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal? OriginalAmount { get; set; }

    [BsonElement("originalCurrency")]
    public string? OriginalCurrency { get; set; }

    // Cuenta relacionada
    [BsonElement("accountId")]
    public string? AccountId { get; set; }

    [BsonElement("accountNumber")]
    public string? AccountNumber { get; set; }

    [BsonElement("bank")]
    public string? Bank { get; set; }

    [BsonElement("email")]
    public string? Email { get; set; }

    [BsonElement("wallet")]
    public string? Wallet { get; set; }

    // Zelle
    [BsonElement("envia")]
    public string? Envia { get; set; }

    // Estado Conciliación
    [BsonElement("isConciliated")]
    public bool IsConciliated { get; set; } = false;

    [BsonElement("casheaFinancedPortion")]
    public bool CasheaFinancedPortion { get; set; }

    [BsonElement("cardCommissionApplied")]
    public bool CardCommissionApplied { get; set; }

    [BsonElement("cardCommissionAmount")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal? CardCommissionAmount { get; set; }
}
