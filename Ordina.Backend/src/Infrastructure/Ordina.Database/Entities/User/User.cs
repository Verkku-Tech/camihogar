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
    [BsonElement("commissionExclusivityMode")]
    public string? CommissionExclusivityModeStored { get; set; }

    /// <summary>Campo legacy en MongoDB; se mantiene sincronizado al persistir.</summary>
    [BsonElement("exclusiveCommission")]
    public bool ExclusiveCommissionStored { get; set; } = false;

    [BsonIgnore]
    public string CommissionExclusivityMode
    {
        get => CommissionExclusivityModes.Normalize(CommissionExclusivityModeStored, ExclusiveCommissionStored);
        set => CommissionExclusivityModeStored = value;
    }

    [BsonIgnore]
    public bool ExclusiveCommission =>
        CommissionExclusivityModes.IsExclusive(CommissionExclusivityMode);

    [BsonElement("baseSalary")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal BaseSalary { get; set; } = 0; // Sueldo fijo del vendedor

    [BsonElement("baseSalaryCurrency")]
    public string BaseSalaryCurrency { get; set; } = "USD"; // Moneda del sueldo

    /// <summary>
    /// Normaliza el modo desde el valor almacenado o el flag legacy y sincroniza el flag legacy.
    /// </summary>
    public void NormalizeCommissionExclusivity()
    {
        var normalized = CommissionExclusivityModes.Normalize(
            CommissionExclusivityModeStored,
            ExclusiveCommissionStored);
        CommissionExclusivityModeStored = normalized;
        ExclusiveCommissionStored = CommissionExclusivityModes.IsExclusive(normalized);
    }
}
