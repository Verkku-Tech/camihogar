namespace Ordina.Orders.Application.DTOs;

public class OrderResponseDto
{
    public string Id { get; set; } = string.Empty;
    public string OrderNumber { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public string ClientName { get; set; } = string.Empty;
    public string VendorId { get; set; } = string.Empty;
    public string VendorName { get; set; } = string.Empty;
    public string? ReferrerId { get; set; }
    public string? ReferrerName { get; set; }
    public List<OrderProductDto> Products { get; set; } = new();
    public decimal Subtotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal DeliveryCost { get; set; }
    public decimal Total { get; set; }
    public decimal? SubtotalBeforeDiscounts { get; set; }
    public decimal? ProductDiscountTotal { get; set; }
    public decimal? GeneralDiscountAmount { get; set; }
    public string PaymentType { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    public PaymentDetailsDto? PaymentDetails { get; set; }
    public List<PartialPaymentDto>? PartialPayments { get; set; }
    public List<PartialPaymentDto>? MixedPayments { get; set; }
    public string? DeliveryAddress { get; set; }
    public bool HasDelivery { get; set; }
    public DeliveryServicesDto? DeliveryServices { get; set; }
    public string Status { get; set; } = string.Empty;
    public Dictionary<string, decimal>? ProductMarkups { get; set; }
    public bool? CreateSupplierOrder { get; set; }
    public string? Observations { get; set; }
    public string? SaleType { get; set; }
    public string? DeliveryType { get; set; }
    public string? DeliveryZone { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

