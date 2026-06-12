using System.ComponentModel.DataAnnotations;

namespace Ordina.Orders.Application.DTOs;

/// <summary>
/// Datos para convertir una reserva (RES-) en pedido real (ORD).
/// </summary>
public class ConfirmOrderDto
{
    [Required(ErrorMessage = "El ID del vendedor de tienda es requerido")]
    public string StoreVendorId { get; set; } = string.Empty;

    [Required(ErrorMessage = "El nombre del vendedor de tienda es requerido")]
    public string StoreVendorName { get; set; } = string.Empty;

    /// <summary>Líneas finales; si es null o vacío se usan las de la reserva.</summary>
    public List<OrderProductDto>? Products { get; set; }

    [Required(ErrorMessage = "El tipo de pago es requerido")]
    public string PaymentType { get; set; } = string.Empty;

    [Required(ErrorMessage = "El método de pago es requerido")]
    public string PaymentMethod { get; set; } = string.Empty;

    public string? PaymentCondition { get; set; }
    public PaymentDetailsDto? PaymentDetails { get; set; }
    public List<PartialPaymentDto>? PartialPayments { get; set; }
    public List<PartialPaymentDto>? MixedPayments { get; set; }

    public string? SaleType { get; set; }
    public string? DeliveryType { get; set; }
    public string? DeliveryZone { get; set; }
    public string? DeliveryAddress { get; set; }
    public bool? HasDelivery { get; set; }
    public DeliveryServicesDto? DeliveryServices { get; set; }
    public string? Observations { get; set; }

    public decimal? Subtotal { get; set; }
    public decimal? TaxAmount { get; set; }
    public decimal? DeliveryCost { get; set; }
    public decimal? Total { get; set; }
    public decimal? SubtotalBeforeDiscounts { get; set; }
    public decimal? ProductDiscountTotal { get; set; }
    public decimal? GeneralDiscountAmount { get; set; }
    public string? GeneralDiscountType { get; set; }
    public decimal? GeneralDiscountPercent { get; set; }

    public Dictionary<string, decimal>? ProductMarkups { get; set; }
    public bool? CreateSupplierOrder { get; set; }

    public string? PostventaId { get; set; }
    public string? PostventaName { get; set; }

    public string? ConvertedFromNumber { get; set; }

    public ExchangeRatesAtCreationDto? ExchangeRatesAtCreation { get; set; }

    public string? BaseCurrency { get; set; }
}
