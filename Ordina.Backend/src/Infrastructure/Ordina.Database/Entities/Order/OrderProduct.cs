using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Order;

public class OrderProduct
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;

    [BsonElement("price")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Price { get; set; }

    [BsonElement("quantity")]
    public int Quantity { get; set; }

    [BsonElement("total")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Total { get; set; }

    [BsonElement("category")]
    public string Category { get; set; } = string.Empty;

    [BsonElement("stock")]
    public int Stock { get; set; } // Stock disponible al momento del pedido

    [BsonElement("attributes")]
    public Dictionary<string, object>? Attributes { get; set; }

    [BsonElement("discount")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal? Discount { get; set; } // Descuento aplicado al producto (monto)

    [BsonElement("observations")]
    public string? Observations { get; set; } // Observaciones específicas del producto

    // Campos de fabricación
    [BsonElement("availabilityStatus")]
    public string? AvailabilityStatus { get; set; } // "disponible" | "no_disponible"

    [BsonElement("manufacturingStatus")]
    public string? ManufacturingStatus { get; set; } // "debe_fabricar" | "fabricando" | "almacen_no_fabricado" (3 estados; último = En almacén)

    [BsonElement("manufacturingProviderId")]
    public string? ManufacturingProviderId { get; set; }

    [BsonElement("manufacturingProviderName")]
    public string? ManufacturingProviderName { get; set; }

    [BsonElement("manufacturingStartedAt")]
    public DateTime? ManufacturingStartedAt { get; set; }

    [BsonElement("manufacturingCompletedAt")]
    public DateTime? ManufacturingCompletedAt { get; set; }

    [BsonElement("manufacturingNotes")]
    public string? ManufacturingNotes { get; set; }

    [BsonElement("locationStatus")]
    public string? LocationStatus { get; set; } // "EN TIENDA" | "FABRICACION" | null/empty

    [BsonElement("images")]
    public List<ProductImage>? Images { get; set; } // Imágenes del producto
}
