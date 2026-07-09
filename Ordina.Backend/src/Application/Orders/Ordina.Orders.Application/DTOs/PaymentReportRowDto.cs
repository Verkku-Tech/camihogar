namespace Ordina.Orders.Application.DTOs;

public class PaymentReportRowDto
{
    public string Fecha { get; set; } = string.Empty;
    public string Pedido { get; set; } = string.Empty;
    public string Cliente { get; set; } = string.Empty;
    public string MetodoPago { get; set; } = string.Empty;
    public decimal MontoOriginal { get; set; }
    public string MonedaOriginal { get; set; } = string.Empty;
    /// <summary>
    /// Equivalente en Bs cuando aplica (p. ej. transferencia o pago móvil en USD con tasa).
    /// Null si el pago fue en divisas por métodos solo extranjeros (Zelle, Binance, bancos Panamá, etc.): no se convierte a Bs en el reporte.
    /// </summary>
    public decimal? MontoBs { get; set; }
    /// <summary>
    /// Equivalente en USD: originalAmount en USD si existe; si no, Bs convertidos con tasa del cobro
    /// (exchangeRate del pago) o, en legacy, tasa del pedido al crearlo.
    /// </summary>
    public decimal? MontoUsd { get; set; }
    public string Cuenta { get; set; } = string.Empty;
    public string Referencia { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public string PaymentType { get; set; } = string.Empty;
    public int PaymentIndex { get; set; } = -1;
    public bool IsConciliated { get; set; }
}

