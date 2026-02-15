using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Account;

public class Account
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("code")]
    public string Code { get; set; } = string.Empty; // Código de la cuenta (ej: Banesco_POS)

    [BsonElement("label")]
    public string Label { get; set; } = string.Empty; // Etiqueta o Nombre (ej: Punto de Venta Banesco)

    [BsonElement("storeId")]
    public string StoreId { get; set; } = string.Empty; // ID de la tienda asociada

    [BsonElement("isForeign")]
    public bool IsForeign { get; set; } // true = Extranjera, false = Nacional

    [BsonElement("accountType")]
    public string AccountType { get; set; } = string.Empty; // "Cuentas Digitales", "Ahorro", "Corriente", etc.

    [BsonElement("email")]
    public string? Email { get; set; } // Correo (solo para cuentas digitales)

    [BsonElement("wallet")]
    public string? Wallet { get; set; } // Wallet (solo para cuentas digitales)

    [BsonElement("isActive")]
    public bool IsActive { get; set; } = true; // true = Activa, false = Inactiva

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}