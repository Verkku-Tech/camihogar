using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Order;

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
}
