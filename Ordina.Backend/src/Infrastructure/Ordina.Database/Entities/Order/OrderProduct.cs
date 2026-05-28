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

    /// <summary>Moneda de Price y Total (USD, Bs, EUR). Legacy sin campo = Bs.</summary>
    [BsonElement("priceCurrency")]
    public string? PriceCurrency { get; set; }

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

    // Campos de refabricación (cuando un producto en almacén se devuelve a fabricación)
    [BsonElement("refabricationReason")]
    public string? RefabricationReason { get; set; } // Razón de la última refabricación

    [BsonElement("refabricatedAt")]
    public DateTime? RefabricatedAt { get; set; } // Fecha de última refabricación

    [BsonElement("refabricationHistory")]
    public List<RefabricationRecord>? RefabricationHistory { get; set; } // Historial de refabricaciones

    [BsonElement("locationStatus")]
    public string? LocationStatus { get; set; } // "EN TIENDA" | "FABRICACION" | null/empty

    [BsonElement("logisticStatus")]
    public string LogisticStatus { get; set; } = "Generado"; // "Generado", "Fabricándose", "En Almacén", "En Ruta", "Completado"

    /// <summary>Momento en que el ítem pasó a entregado/despachado (location DESPACHADO + logística Completado).</summary>
    [BsonElement("deliveredAt")]
    public DateTime? DeliveredAt { get; set; }

    // Campos de sobreprecio
    [BsonElement("surchargeEnabled")]
    public bool? SurchargeEnabled { get; set; } // Indica si tiene sobreprecio

    [BsonElement("surchargeAmount")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal? SurchargeAmount { get; set; } // Monto del sobreprecio (en USD)

    [BsonElement("surchargeReason")]
    public string? SurchargeReason { get; set; } // Razón del sobreprecio

    [BsonElement("images")]
    public List<ProductImage>? Images { get; set; } // Imágenes del producto

    /// <summary>Origen de la línea para comisión: reservation_unchanged | store_modified | store_added | store_substitution</summary>
    [BsonElement("commissionLineSource")]
    public string? CommissionLineSource { get; set; }

    /// <summary>ID de catálogo estable (prefijo del line id) para matching en conversión de reserva.</summary>
    [BsonElement("catalogProductId")]
    public string? CatalogProductId { get; set; }
}
