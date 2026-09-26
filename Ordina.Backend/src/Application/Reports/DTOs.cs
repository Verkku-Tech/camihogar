namespace Ordina.Application.Reports;


public record CommissionReportRowDto(
    string OrderNumber,
    DateTime Date,
    string SellerName,
    string ClientName,
    decimal OrderTotal,
    decimal CommissionAmount,
    string CommissionMode,
    string? Description = null,
    int? ItemsCount = null,
    string? SaleType = null,
    decimal? ComisionFamiliaUsdPorUnidad = null,
    decimal? Comision = null,
    decimal? ComisionPostventa = null,
    decimal? ComisionSecundaria = null,
    string? VendedorPostventa = null,
    string? VendedorSecundario = null,
    string? Fecha = null,
    string? Cliente = null,
    string? Pedido = null,
    string? Vendedor = null,
    string? Descripcion = null,
    int? CantidadArticulos = null,
    string? TipoVenta = null);

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
