namespace Ordina.Orders.Application.DTOs;

public class DispatchReportRowDto
{
    public string NotaDespacho { get; set; } = string.Empty;
    public string Cliente { get; set; } = string.Empty;
    public string Telefono1 { get; set; } = string.Empty;
    public string Telefono2 { get; set; } = string.Empty;
    public int CantidadTotal { get; set; }
    public string Descripcion { get; set; } = string.Empty;
    public string Direccion { get; set; } = string.Empty;
    public string EstadoPago { get; set; } = string.Empty;
    public decimal ImporteTotal { get; set; }
    /// <summary>Saldo por cobrar en tienda (USD), 0 si está pagado.</summary>
    public decimal SaldoPendiente { get; set; }
}
