using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Commission;

/// <summary>
/// Define las reglas de distribución de comisiones según el tipo de venta.
/// Se usa cuando hay ventas compartidas (vendedor + referido/postventa).
/// </summary>
public class SaleTypeCommissionRule
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("saleType")]
    public string SaleType { get; set; } = string.Empty; // "entrega", "encargo", "sistema_apartado", etc.

    [BsonElement("saleTypeLabel")]
    public string SaleTypeLabel { get; set; } = string.Empty; // "Entrega", "Encargo", etc. (para display)

    [BsonElement("vendorRate")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal VendorRate { get; set; } // 2.5, 2, 1.5, etc. (porcentaje que gana el vendedor de tienda)

    [BsonElement("referrerRate")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal ReferrerRate { get; set; } // 0, 1, 1.5, etc. (porcentaje que gana el referido/postventa)

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
