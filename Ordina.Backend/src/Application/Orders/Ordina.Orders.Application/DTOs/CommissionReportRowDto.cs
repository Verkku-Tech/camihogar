namespace Ordina.Orders.Application.DTOs;

public class CommissionReportRowDto
{
    public string Fecha { get; set; } = string.Empty;
    public string Cliente { get; set; } = string.Empty;
    public string Vendedor { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public int CantidadArticulos { get; set; }
    public string TipoCompra { get; set; } = string.Empty;
    public decimal Comision { get; set; }
    public string? VendedorSecundario { get; set; } // Para ventas compartidas
    public decimal? ComisionSecundaria { get; set; } // Para ventas compartidas
}

