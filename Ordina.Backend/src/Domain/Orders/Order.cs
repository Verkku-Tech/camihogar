using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;
using Ordina.Domain.Enums;

namespace Ordina.Domain.Orders;

public class Order : BaseEntity
{
    [BsonElement("orderNumber")]
    public string OrderNumber { get; set; } = string.Empty;

    [BsonElement("convertedFromNumber")]
    public string ConvertedFromNumber { get; set; } = string.Empty;

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

    [BsonElement("postventaId")]
    public string? PostventaId { get; set; }

    [BsonElement("postventaName")]
    public string? PostventaName { get; set; }

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

    [BsonElement("generalDiscountType")]
    public string? GeneralDiscountType { get; set; }

    [BsonElement("generalDiscountPercent")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal? GeneralDiscountPercent { get; set; }

    [BsonElement("paymentType")]
    public string PaymentTypeString { get; set; } = "directo";

    [BsonIgnore]
    public PaymentType PaymentType
    {
        get => PaymentTypeExtensions.ParsePaymentType(PaymentTypeString);
        set => PaymentTypeString = value.ToDbString();
    }

    [BsonElement("paymentMethod")]
    public string PaymentMethod { get; set; } = string.Empty;

    [BsonElement("paymentCondition")]
    public string? PaymentCondition { get; set; }

    [BsonElement("paymentDetails")]
    public PaymentDetails? PaymentDetails { get; set; }

    [BsonElement("partialPayments")]
    public List<PartialPayment>? PartialPayments { get; set; }

    [BsonElement("mixedPayments")]
    public List<PartialPayment>? MixedPayments { get; set; }

    [BsonElement("appliedStoreCreditUsd")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal AppliedStoreCreditUsd { get; set; }

    [BsonElement("deliveryAddress")]
    public string? DeliveryAddress { get; set; }

    [BsonElement("hasDelivery")]
    public bool HasDelivery { get; set; }

    [BsonElement("deliveryServices")]
    public DeliveryServices? DeliveryServices { get; set; }

    [BsonElement("status")]
    public string StatusString { get; set; } = "Pendiente";

    [BsonIgnore]
    public OrderStatus Status
    {
        get => OrderStatusExtensions.ParseOrderStatus(StatusString);
        set => StatusString = value.ToDbString();
    }

    [BsonElement("productMarkups")]
    public Dictionary<string, decimal>? ProductMarkups { get; set; }

    [BsonElement("createSupplierOrder")]
    public bool? CreateSupplierOrder { get; set; }

    [BsonElement("observations")]
    public string? Observations { get; set; }

    [BsonElement("dispatchObservations")]
    public string? DispatchObservations { get; set; }

    [BsonElement("declineReason")]
    public string? DeclineReason { get; set; }

    [BsonElement("saleType")]
    public string? SaleTypeString { get; set; }

    [BsonIgnore]
    public SaleType? SaleType
    {
        get => SaleTypeString != null ? SaleTypeExtensions.ParseSaleType(SaleTypeString) : null;
        set => SaleTypeString = value?.ToDbString();
    }

    [BsonElement("deliveryType")]
    public string? DeliveryTypeString { get; set; }

    [BsonIgnore]
    public DeliveryType? DeliveryType
    {
        get => DeliveryTypeString != null ? DeliveryTypeExtensions.ParseDeliveryType(DeliveryTypeString) : null;
        set => DeliveryTypeString = value?.ToDbString();
    }

    [BsonElement("deliveryZone")]
    public string? DeliveryZone { get; set; }

    [BsonElement("exchangeRatesAtCreation")]
    public ExchangeRatesAtCreation? ExchangeRatesAtCreation { get; set; }

    [BsonElement("baseCurrency")]
    public string? BaseCurrency { get; set; } = "USD";

    [BsonElement("type")]
    public string TypeString { get; set; } = "Order";

    [BsonIgnore]
    public OrderType Type
    {
        get => OrderTypeExtensions.ParseOrderType(TypeString);
        set => TypeString = value.ToDbString();
    }

    [BsonElement("originalOrderId")]
    public string? OriginalOrderId { get; set; }

    [BsonElement("originalProducts")]
    public List<OrderProduct>? OriginalProducts { get; set; }

    [BsonElement("sourceReservationVendorId")]
    public string? SourceReservationVendorId { get; set; }

    [BsonElement("sourceReservationVendorName")]
    public string? SourceReservationVendorName { get; set; }
}
