using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Commission;

/// <summary>
/// Representa la comisión configurada para una categoría/familia de productos.
/// Las comisiones se pagan en múltiplos de 2.5 (2.5, 5, 7.5, etc.)
/// </summary>
public class ProductCommission
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("categoryId")]
    public string CategoryId { get; set; } = string.Empty;

    [BsonElement("categoryName")]
    public string CategoryName { get; set; } = string.Empty; // Para display

    [BsonElement("commissionValue")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal CommissionValue { get; set; } // 2.5, 5, 7.5, etc.

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
