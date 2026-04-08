namespace Ordina.Orders.Application.DTOs;

public class PaymentReportRowDto
{
    public string Fecha { get; set; } = string.Empty;
    public string Pedido { get; set; } = string.Empty;
    public string Cliente { get; set; } = string.Empty;
    public string MetodoPago { get; set; } = string.Empty;
    public decimal MontoOriginal { get; set; }
    public string MonedaOriginal { get; set; } = string.Empty;
    public decimal MontoBs { get; set; }
    /// <summary>Equivalente en USD cuando el pago es en Bs (tasa del día del pedido).</summary>
    public decimal? MontoUsd { get; set; }
    public string Cuenta { get; set; } = string.Empty;
    public string Referencia { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public string PaymentType { get; set; } = string.Empty;
    public int PaymentIndex { get; set; } = -1;
    public bool IsConciliated { get; set; }
}

