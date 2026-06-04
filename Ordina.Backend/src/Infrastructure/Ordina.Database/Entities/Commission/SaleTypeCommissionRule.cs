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

    /// <summary>USD de comisión familia por unidad (2.5, 5 o 7.5). 0 = documento legacy sin migrar.</summary>
    [BsonElement("familyCommissionUsdPerUnit")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal FamilyCommissionUsdPerUnit { get; set; }

    /// <summary>USD por unidad vendida para vendedor de tienda (venta compartida).</summary>
    [BsonElement("vendorRate")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal VendorRate { get; set; }

    /// <summary>USD por unidad vendida para referido online (venta compartida).</summary>
    [BsonElement("referrerRate")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal ReferrerRate { get; set; }

    /// <summary>USD por unidad vendida para post venta (venta compartida).</summary>
    [BsonElement("postventaRate")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal PostventaRate { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
