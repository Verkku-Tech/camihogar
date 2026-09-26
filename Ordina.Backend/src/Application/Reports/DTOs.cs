namespace Ordina.Application.Reports;


public class CommissionReportRowDto
{
    public string Fecha { get; set; } = string.Empty;
    public string Cliente { get; set; } = string.Empty;
    public string Vendedor { get; set; } = string.Empty;
    public string Pedido { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public int CantidadArticulos { get; set; }
    public string TipoVenta { get; set; } = string.Empty;
    public decimal ComisionFamiliaUsdPorUnidad { get; set; }
    public decimal Comision { get; set; }
    public string? VendedorSecundario { get; set; }
    public decimal? ComisionSecundaria { get; set; }
    public string? VendedorPostventa { get; set; }
    public decimal? ComisionPostventa { get; set; }
    public decimal SueldoBase { get; set; }
    public decimal TotalComisionMasSueldo => Comision + SueldoBase;
    public decimal TasaComisionBase { get; set; }
    public decimal TasaAplicadaVendedor { get; set; }
    public decimal? TasaAplicadaReferido { get; set; }
    public decimal? TasaAplicadaPostventa { get; set; }
    public bool EsVentaCompartida { get; set; }
    public bool EsVendedorExclusivo { get; set; }
}

public class CommissionReferrerOptionDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public record PaymentsDetailedReportRowDto(
    string OrderNumber,
    DateTime Date,
    string ClientName,
    decimal Amount,
    string Method,
    string? Bank,
    string? Reference,
    bool IsConciliated);

public class PaymentReportRowDto
{
    public string Fecha { get; set; } = string.Empty;
    public string Pedido { get; set; } = string.Empty;
    public string Cliente { get; set; } = string.Empty;
    public string MetodoPago { get; set; } = string.Empty;
    public decimal MontoOriginal { get; set; }
    public string MonedaOriginal { get; set; } = string.Empty;
    public decimal? MontoBs { get; set; }
    public decimal? MontoUsd { get; set; }
    public string Cuenta { get; set; } = string.Empty;
    public string Referencia { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public string PaymentType { get; set; } = string.Empty;
    public int PaymentIndex { get; set; } = -1;
    public bool IsConciliated { get; set; }
}

public record ManufacturingReportPreviewDto(
    string Pedido,
    DateTime Fecha,
    string Cliente,
    string Fabricante,
    string Descripcion,
    int Cantidad,
    string Estado,
    string ObservacionesVendedor,
    string ObservacionesFabricante,
    string NotasRefabricacion);

public record DispatchReportPreviewDto(
    string NotaDespacho,
    string Cliente,
    string Telefono1,
    string Telefono2,
    int CantidadTotal,
    string Descripcion,
    string Direccion,
    string EstadoPago,
    decimal ImporteTotal,
    decimal SaldoPendiente,
    string InformacionDespacho,
    string DispatchObservations,
    string EstadoUbicacion);
