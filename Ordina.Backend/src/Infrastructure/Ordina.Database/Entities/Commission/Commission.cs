using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Commission;

public class Commission
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("commissionType")]
    public string CommissionType { get; set; } = string.Empty; // "role" | "user"

    [BsonElement("role")]
    public string? Role { get; set; } // Solo si commissionType === "role"

    [BsonElement("userId")]
    public string? UserId { get; set; } // Solo si commissionType === "user"

    [BsonElement("userName")]
    public string? UserName { get; set; } // Nombre del usuario (para display)

    [BsonElement("commissionKind")]
    public string CommissionKind { get; set; } = string.Empty; // "percentage" | "net"

    [BsonElement("value")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Value { get; set; } // Valor o cantidad

    [BsonElement("currency")]
    public string Currency { get; set; } = "Bs"; // "Bs" | "USD" | "EUR"

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

