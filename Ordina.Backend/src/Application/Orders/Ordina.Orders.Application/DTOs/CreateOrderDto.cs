using System.ComponentModel.DataAnnotations;

namespace Ordina.Orders.Application.DTOs;

public class CreateOrderDto
{
    [Required(ErrorMessage = "El ID del cliente es requerido")]
    public string ClientId { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "El nombre del cliente es requerido")]
    public string ClientName { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "El ID del vendedor es requerido")]
    public string VendorId { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "El nombre del vendedor es requerido")]
    public string VendorName { get; set; } = string.Empty;
    
    public string? ReferrerId { get; set; }
    public string? ReferrerName { get; set; }
    
    [Required(ErrorMessage = "Los productos son requeridos")]
    public List<OrderProductDto> Products { get; set; } = new();
    
    [Required(ErrorMessage = "El subtotal es requerido")]
    public decimal Subtotal { get; set; }
    
    public decimal TaxAmount { get; set; }
    public decimal DeliveryCost { get; set; }
    
    [Required(ErrorMessage = "El total es requerido")]
    public decimal Total { get; set; }
    
    public decimal? SubtotalBeforeDiscounts { get; set; }
    public decimal? ProductDiscountTotal { get; set; }
    public decimal? GeneralDiscountAmount { get; set; }
    
    [Required(ErrorMessage = "El tipo de pago es requerido")]
    public string PaymentType { get; set; } = string.Empty;
    
    [Required(ErrorMessage = "El método de pago es requerido")]
    public string PaymentMethod { get; set; } = string.Empty;
    
    public PaymentDetailsDto? PaymentDetails { get; set; }
    public List<PartialPaymentDto>? PartialPayments { get; set; }
    public List<PartialPaymentDto>? MixedPayments { get; set; }
    
    public string? DeliveryAddress { get; set; }
    public bool HasDelivery { get; set; }
    public DeliveryServicesDto? DeliveryServices { get; set; }
    public string Status { get; set; } = "Generado";
    public Dictionary<string, decimal>? ProductMarkups { get; set; }
    public bool? CreateSupplierOrder { get; set; }
    public string? Observations { get; set; }
    public string? SaleType { get; set; }
    public string? DeliveryType { get; set; }
    public string? DeliveryZone { get; set; }
}

