using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Ordina.Database.Entities.Order;

public class Order
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = string.Empty;

    [BsonElement("orderNumber")]
    public string OrderNumber { get; set; } = string.Empty;

    [BsonElement("clientId")]
    public string ClientId { get; set; } = string.Empty;

    [BsonElement("clientName")]
    public string ClientName { get; set; } = string.Empty;

    [BsonElement("vendorId")]
    public string VendorId { get; set; } = string.Empty;

    [BsonElement("vendorName")]
    public string VendorName { get; set; } = string.Empty;

    [BsonElement("referrerId")]
    public string? ReferrerId { get; set; }

    [BsonElement("referrerName")]
    public string? ReferrerName { get; set; }

    [BsonElement("products")]
    public List<OrderProduct> Products { get; set; } = new();

    [BsonElement("subtotal")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Subtotal { get; set; }

    [BsonElement("taxAmount")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal TaxAmount { get; set; }

    [BsonElement("deliveryCost")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal DeliveryCost { get; set; }

    [BsonElement("total")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal Total { get; set; }

    [BsonElement("subtotalBeforeDiscounts")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal? SubtotalBeforeDiscounts { get; set; }

    [BsonElement("productDiscountTotal")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal? ProductDiscountTotal { get; set; }

    [BsonElement("generalDiscountAmount")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal? GeneralDiscountAmount { get; set; }

    [BsonElement("paymentType")]
    public string PaymentType { get; set; } = string.Empty; // "directo", "apartado", "mixto"

    [BsonElement("paymentMethod")]
    public string PaymentMethod { get; set; } = string.Empty;

    [BsonElement("paymentDetails")]
    public PaymentDetails? PaymentDetails { get; set; }

    [BsonElement("partialPayments")]
    public List<PartialPayment>? PartialPayments { get; set; }

    [BsonElement("mixedPayments")]
    public List<PartialPayment>? MixedPayments { get; set; }

    [BsonElement("deliveryAddress")]
    public string? DeliveryAddress { get; set; }

    [BsonElement("hasDelivery")]
    public bool HasDelivery { get; set; }

    [BsonElement("deliveryServices")]
    public DeliveryServices? DeliveryServices { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = "Pendiente"; // "Pendiente", "Apartado", "Completado", "Cancelado"

    [BsonElement("productMarkups")]
    public Dictionary<string, decimal>? ProductMarkups { get; set; }

    [BsonElement("createSupplierOrder")]
    public bool? CreateSupplierOrder { get; set; }

    [BsonElement("observations")]
    public string? Observations { get; set; } // Observaciones generales del pedido

    [BsonElement("saleType")]
    public string? SaleType { get; set; } // "encargo", "entrega", "sistema_apartado"

    [BsonElement("deliveryType")]
    public string? DeliveryType { get; set; } // "entrega_programada", "delivery_express", "retiro_tienda", "retiro_almacen"

    [BsonElement("deliveryZone")]
    public string? DeliveryZone { get; set; } // "caracas", "g_g", "san_antonio_los_teques", "caucagua_higuerote", "la_guaira", "charallave_cua", "interior_pais"

    [BsonElement("exchangeRatesAtCreation")]
    public ExchangeRatesAtCreation? ExchangeRatesAtCreation { get; set; } // Tasas de cambio del día en que se creó el pedido

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
