namespace Ordina.Orders.Application.DTOs;

public class DispatchReportRowDto
{
    public string Fecha { get; set; } = string.Empty;
    public string NotaDespacho { get; set; } = string.Empty;
    public string Cliente { get; set; } = string.Empty;
    public string Telefono1 { get; set; } = string.Empty;
    public string Telefono2 { get; set; } = string.Empty;
    public int CantidadTotal { get; set; }
    public string Descripcion { get; set; } = string.Empty;
    public string Zona { get; set; } = string.Empty;
    public string Direccion { get; set; } = string.Empty;
    public string Observaciones { get; set; } = string.Empty;
    public string EstadoPago { get; set; } = string.Empty;
    public decimal ImporteTotal { get; set; }
}

