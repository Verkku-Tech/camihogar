namespace Ordina.Orders.Application.DTOs;

public class ManufacturingReportRowDto
{
    public string Fecha { get; set; } = string.Empty;
    public string Pedido { get; set; } = string.Empty;
    public string Estado { get; set; } = string.Empty;
    public string Cliente { get; set; } = string.Empty;
    public string Fabricante { get; set; } = string.Empty;
    public int Cantidad { get; set; }
    public string Descripcion { get; set; } = string.Empty;
    public string ObservacionesVendedor { get; set; } = string.Empty;
    public string ObservacionesFabricante { get; set; } = string.Empty;
}

