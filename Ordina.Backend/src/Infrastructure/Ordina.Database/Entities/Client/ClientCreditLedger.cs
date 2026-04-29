using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Client;

/// <summary>
/// Movimiento de saldo a favor del cliente (USD). Positivo acredita, negativo consume.
/// </summary>
public class ClientCreditLedger
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("clientId")]
    public string ClientId { get; set; } = string.Empty;

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Positivo: crédito; negativo: aplicación a pedido u ajuste que devuelve crédito.</summary>
    [BsonElement("amountUsd")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal AmountUsd { get; set; }

    /// <summary>overpayment | apply_order | adjustment</summary>
    [BsonElement("type")]
    public string Type { get; set; } = string.Empty;

    [BsonElement("orderId")]
    public string? OrderId { get; set; }

    [BsonElement("createdByUserId")]
    public string? CreatedByUserId { get; set; }

    /// <summary>JSON opcional: moneda origen, tasas, resumen de abonos.</summary>
    [BsonElement("metadata")]
    public string? Metadata { get; set; }
}
