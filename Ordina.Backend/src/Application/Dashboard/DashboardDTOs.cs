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
    public decimal ActiveLayawaysBalanceUsd { get; set; }
    public int ActiveLayawaysCount { get; set; }
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
    decimal TotalUsd,
    decimal EstimatedCommissionUsd = 0m);

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
    int Delivered,
    decimal ManufacturingUsd = 0m,
    decimal WarehouseUsd = 0m,
    decimal DispatchUsd = 0m,
    decimal DeliveredUsd = 0m);

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

public record AgingReportDto(
    string Range,
    string Label,
    int Count,
    decimal TotalBalanceUsd);

public record PaymentMixDto(
    string Method,
    string Label,
    int Count,
    decimal TotalUsd,
    decimal Percentage);

public record SellerCommissionDto(
    string SellerId,
    string SellerName,
    decimal TotalSalesUsd,
    decimal EstimatedCommissionUsd);

public record AovByBranchDto(
    string BranchId,
    string BranchName,
    decimal AverageOrderValue,
    int OrdersCount,
    decimal TotalSalesUsd);

public record FinancesMetricsResponseDto(
    decimal TotalPendingBalanceUsd,
    IReadOnlyList<AgingReportDto> AgingReport,
    IReadOnlyList<PaymentMixDto> PaymentMix,
    IReadOnlyList<SellerCommissionDto> TopSellersCommissions,
    IReadOnlyList<AovByBranchDto> AovByBranch);

public record ManufacturingLeadTimeDto(
    string Category,
    double AverageDays,
    int CompletedUnits);

public record OtifMetricsDto(
    decimal OtifRate,
    int OnTimeOrders,
    int DelayedOrders,
    int TotalDeliveredOrders);

public record StageDwellTimeDto(
    string StageName,
    double AverageDays,
    int ActiveOrdersCount);

public record FulfillmentRatioDto(
    int ImmediateCount,
    decimal ImmediatePercentage,
    int MadeToOrderCount,
    decimal MadeToOrderPercentage);

public record ConversionRateDto(
    int TotalReservations,
    int ConvertedOrders,
    decimal WinRatePercentage,
    decimal ConvertedVolumeUsd);

public record ClosingVelocityDto(
    double AverageDaysToClose,
    double MedianHoursToFirstPayment,
    int AnalyzedOrdersCount);

public record ReplenishmentSuggestionDto(
    string ProductName,
    string VariantName,
    IReadOnlyDictionary<string, string> Attributes,
    int SalesRank,
    int CurrentStockTerrinca,
    int CurrentStockStores,
    int SuggestedQuantity,
    string Priority);

public record StockTurnoverDto(
    double AverageDaysInWarehouse,
    int SlowMovingItemsCount,
    int TotalActiveStockUnits);

public record StockoutRateDto(
    decimal StockoutRatePercentage,
    int StockoutIncidentsCount,
    string StatusNote = "Próximamente disponible con registro de consultas sin stock");

public record StoreOccupancyDto(
    string StoreId,
    string StoreName,
    int CurrentItems,
    int MaxCapacity,
    decimal OccupancyPercentage,
    string StatusNote = "Próximamente disponible con configuración de topes físicos de tienda");

public record AgingOrderDetailDto(
    string OrderId,
    string OrderNumber,
    DateTime CreatedAt,
    string ClientName,
    string VendorName,
    string StoreName,
    string Status,
    string SaleType,
    decimal TotalUsd,
    decimal PaidUsd,
    decimal PendingBalanceUsd,
    int DaysElapsed,
    int DaysExpired,
    string RangeKey,
    string RangeLabel);

public record PaymentDrillDownDto(
    string PaymentId,
    string OrderId,
    string OrderNumber,
    DateTime PaymentDate,
    DateTime OrderDate,
    string ClientName,
    string VendorName,
    string StoreName,
    string Method,
    string Reference,
    string Bank,
    decimal AmountUsd,
    decimal AmountBs,
    decimal ExchangeRate,
    bool IsConciliated,
    string Status,
    bool IsFromCurrentPeriodOrder);

public record CollectedDrillDownResponseDto(
    decimal TotalCollectedUsd,
    decimal CurrentPeriodCollectedUsd,
    decimal PriorPeriodCollectedUsd,
    decimal CurrentPeriodPercentage,
    decimal PriorPeriodPercentage,
    IReadOnlyList<PaymentDrillDownDto> CurrentPeriodPayments,
    IReadOnlyList<PaymentDrillDownDto> PriorPeriodPayments);

public record CasheaDrillDownItemDto(
    string OrderId,
    string OrderNumber,
    DateTime OrderDate,
    string ClientName,
    string VendorName,
    string StoreName,
    decimal TotalOrderUsd,
    decimal DownPaymentUsd,
    decimal FinancedCasheaUsd,
    decimal CollectedCasheaUsd,
    decimal PendingCasheaUsd,
    bool IsFullyReconciled,
    string Status);

public record CasheaDrillDownResponseDto(
    int TotalOrdersCount,
    decimal TotalOrdersVolumeUsd,
    decimal TotalDownPaymentUsd,
    decimal TotalFinancedCasheaUsd,
    decimal TotalCollectedCasheaUsd,
    decimal TotalPendingCasheaUsd,
    IReadOnlyList<CasheaDrillDownItemDto> Orders);


