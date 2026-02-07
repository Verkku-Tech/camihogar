namespace Ordina.Orders.Application.DTOs;

public class UpdateOrderDto
{
    public string? ClientId { get; set; }
    public string? ClientName { get; set; }
    public string? VendorId { get; set; }
    public string? VendorName { get; set; }
    public string? ReferrerId { get; set; }
    public string? ReferrerName { get; set; }
    public List<OrderProductDto>? Products { get; set; }
    public decimal? Subtotal { get; set; }
    public decimal? TaxAmount { get; set; }
    public decimal? DeliveryCost { get; set; }
    public decimal? Total { get; set; }
    public decimal? SubtotalBeforeDiscounts { get; set; }
    public decimal? ProductDiscountTotal { get; set; }
    public decimal? GeneralDiscountAmount { get; set; }
    public string? PaymentType { get; set; }
    public string? PaymentMethod { get; set; }
    public PaymentDetailsDto? PaymentDetails { get; set; }
    public List<PartialPaymentDto>? PartialPayments { get; set; }
    public List<PartialPaymentDto>? MixedPayments { get; set; }
    public string? DeliveryAddress { get; set; }
    public bool? HasDelivery { get; set; }
    public DeliveryServicesDto? DeliveryServices { get; set; }
    public string? Status { get; set; }
    public Dictionary<string, decimal>? ProductMarkups { get; set; }
    public bool? CreateSupplierOrder { get; set; }
    public string? Observations { get; set; }
    public string? SaleType { get; set; }
    public string? DeliveryType { get; set; }
    public string? DeliveryZone { get; set; }
}

