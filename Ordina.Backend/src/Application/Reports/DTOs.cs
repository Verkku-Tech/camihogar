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
    string CommissionMode);

public record PaymentsDetailedReportRowDto(
    string OrderNumber,
    DateTime Date,
    string ClientName,
    decimal Amount,
    string Method,
    string? Bank,
    string? Reference,
    bool IsConciliated);
