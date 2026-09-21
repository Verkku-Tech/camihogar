namespace Ordina.Application.Dashboard;

public class MetricChangeDto
{
    public decimal Current { get; set; }
    public decimal Previous { get; set; }
    public decimal Value { get; set; }
    public bool HasBase { get; set; }
    public string Direction { get; set; } = "higher_is_better";
}

public class DashboardMetricsDto
{
    public int CompletedOrders { get; set; }
    public MetricChangeDto? CompletedOrdersChange { get; set; }

    public int TotalSalesCount { get; set; }

    public decimal TotalInvoiced { get; set; }
    public MetricChangeDto? TotalInvoicedChange { get; set; }

    public decimal TotalCollected { get; set; }
    public MetricChangeDto? TotalCollectedChange { get; set; }

    public decimal CasheaFinancedAmount { get; set; }

    public decimal AverageOrderValue { get; set; }
    public MetricChangeDto? AverageOrderValueChange { get; set; }

    public decimal PendingPayments { get; set; }
    public MetricChangeDto? PendingPaymentsChange { get; set; }

    public int ExpiredLayawaysCount { get; set; }
    public decimal ExpiredLayawaysAmount { get; set; }

    public int ProductsToManufacture { get; set; }
    public MetricChangeDto? ProductsToManufactureChange { get; set; }

    // Compatibility fields
    public int TotalOrders => TotalSalesCount;
    public int PendingOrders { get; set; }
    public decimal TotalSalesUsd => TotalInvoiced;
    public decimal TotalCollectedUsd => TotalCollected;
    public decimal ExpiredLayawaysBalanceUsd => ExpiredLayawaysAmount;
    public decimal ActiveLayawaysBalanceUsd => PendingPayments;
    public int ActiveLayawaysCount => TotalSalesCount;
    public int TotalClients { get; set; }
    public int TotalProductsInStock { get; set; }
    public int ManufacturingPendingCount => ProductsToManufacture;
    public int DispatchPendingCount { get; set; }
}

public record TrendDataPointDto(
    string Date,
    int OrdersCount,
    decimal InvoicedUsd,
    decimal CollectedUsd);

public record SaleTypeDataDto(
    string SaleType,
    string Label,
    int Count,
    decimal TotalUsd);

public record TopSellerDto(
    string VendorId,
    string VendorName,
    int OrdersCount,
    decimal TotalUsd);

public record TopProductDto(
    string ProductName,
    string Category,
    int UnitsSold,
    decimal TotalUsd,
    bool HasAttributes = false);

public record AttributeOptionStatDto(
    string Value,
    int UnitsSold,
    decimal Percentage);

public record AttributeBreakdownDto(
    string AttributeId,
    string AttributeTitle,
    int TotalUnitsWithAttribute,
    IReadOnlyList<AttributeOptionStatDto> Options,
    bool IsSuggestedForGrouping = true);

public record ProductVariantOrderSummaryDto(
    string OrderNumber,
    string ClientName,
    DateTime CreatedAt,
    int Quantity,
    decimal TotalUsd,
    string? Status);

public record ProductVariantStatDto(
    int Rank,
    string VariantName,
    IReadOnlyDictionary<string, string> Attributes,
    int UnitsSold,
    decimal Percentage,
    decimal TotalInvoicedUsd,
    IReadOnlyList<string> OrderNumbers,
    IReadOnlyList<ProductVariantOrderSummaryDto>? Orders = null);

public record ProductAttributeBreakdownResponseDto(
    string ProductName,
    string Category,
    int TotalUnitsSold,
    decimal TotalInvoicedUsd,
    decimal AverageUnitPriceUsd,
    int OrdersCount,
    IReadOnlyList<AttributeBreakdownDto> Attributes,
    IReadOnlyList<ProductVariantStatDto> TopVariants,
    int TotalUniqueVariantsCount,
    IReadOnlyList<string> ActiveAttributeIds = null!);

public record PipelineSnapshotDto(
    int Manufacturing,
    int Warehouse,
    int Dispatch,
    int Delivered);

public record ExpiredLayawayAgeRangeDto(
    string Range,
    string Label,
    int Count,
    decimal TotalUsd);

public record ForecastDataPointDto(
    string Date,
    string Label,
    decimal? InvoicedUsd,
    decimal? CollectedUsd,
    decimal? ProjectedInvoiced,
    decimal? ProjectedCollected,
    decimal? Benchmark3Yr);

public record ForecastSummaryDto(
    decimal ProjectedInvoicedTotal,
    decimal ProjectedCollectedTotal,
    decimal? BenchmarkTotal,
    double MapeScore);

public record SalesForecastResponseDto(
    IReadOnlyList<ForecastDataPointDto> Points,
    ForecastSummaryDto Summary);

