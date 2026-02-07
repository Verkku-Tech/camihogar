using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.User;

public class User
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("username")]
    public string Username { get; set; } = string.Empty;

    [BsonElement("email")]
    public string Email { get; set; } = string.Empty;

    [BsonElement("role")]
    public string Role { get; set; } = string.Empty; 
    // "Super Administrator" | "Administrator" | "Supervisor" | "Store Seller" | "Online Seller"

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("status")]
    public string Status { get; set; } = "active"; // "active" | "inactive"

    [BsonElement("createdAt")]
    public DateTime? CreatedAt { get; set; }

    [BsonElement("passwordHash")]
    public string? PasswordHash { get; set; } // Para autenticación

    // Campos para comisiones
    [BsonElement("exclusiveCommission")]
    public bool ExclusiveCommission { get; set; } = false; // Vendedores que NO comparten comisión con referidos

    [BsonElement("baseSalary")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal BaseSalary { get; set; } = 0; // Sueldo fijo del vendedor

    [BsonElement("baseSalaryCurrency")]
    public string BaseSalaryCurrency { get; set; } = "USD"; // Moneda del sueldo
}
