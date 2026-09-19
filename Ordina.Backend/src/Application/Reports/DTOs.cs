namespace Ordina.Application.Reports;

public record DashboardMetricsDto(
    int TotalOrders,
    int PendingOrders,
    int CompletedOrders,
    decimal TotalSalesUsd,
    int TotalClients,
    int TotalProductsInStock,
    int ManufacturingPendingCount,
    int DispatchPendingCount);

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

