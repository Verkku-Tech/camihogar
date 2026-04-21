namespace Ordina.Orders.Application.DTOs;

public class CommissionReportRowDto
{
    // Datos básicos del pedido
    public string Fecha { get; set; } = string.Empty;
    public string Cliente { get; set; } = string.Empty;
    public string Vendedor { get; set; } = string.Empty;
    public string Pedido { get; set; } = string.Empty; // Número de pedido
    public string Descripcion { get; set; } = string.Empty;
    public int CantidadArticulos { get; set; }
    /// <summary>Tipo de venta (saleType/deliveryType) que determina la regla de distribución de comisión.</summary>
    public string TipoVenta { get; set; } = string.Empty;
    
    // Comisión del vendedor principal
    public decimal Comision { get; set; }
    
    // Datos del vendedor secundario (referido) - Solo para ventas compartidas
    public string? VendedorSecundario { get; set; }
    public decimal? ComisionSecundaria { get; set; }

    /// <summary>Usuario o etiqueta de post venta (ENCARGO / SA).</summary>
    public string? VendedorPostventa { get; set; }
    public decimal? ComisionPostventa { get; set; }
    
    // Sueldo y totales
    public decimal SueldoBase { get; set; } // Sueldo fijo del vendedor
    public decimal TotalComisionMasSueldo => Comision + SueldoBase; // Calculado
    
    // Metadata de las tasas aplicadas
    public decimal TasaComisionBase { get; set; } // 2.5, 5, 7.5 (de la categoría)
    public decimal TasaAplicadaVendedor { get; set; } // Tasa después de distribución
    public decimal? TasaAplicadaReferido { get; set; } // Tasa del referido si aplica
    public decimal? TasaAplicadaPostventa { get; set; }
    
    // Flags informativos
    public bool EsVentaCompartida { get; set; }
    public bool EsVendedorExclusivo { get; set; }
}
