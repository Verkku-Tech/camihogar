namespace Ordina.Application.Dashboard;

public interface IDashboardService
{
    Task<DashboardMetricsDto> GetDashboardMetricsAsync(string period = "day", string? storeIds = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TrendDataPointDto>> GetSalesTrendAsync(int days = 30, string? storeIds = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SaleTypeDataDto>> GetBySaleTypeAsync(string period = "month", string? storeIds = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TopSellerDto>> GetTopSellersAsync(string period = "month", int limit = 10, string? storeIds = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TopProductDto>> GetTopProductsAsync(string period = "month", int limit = 10, string? storeIds = null, CancellationToken cancellationToken = default);
    Task<PipelineSnapshotDto> GetPipelineSnapshotAsync(string? storeIds = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ExpiredLayawayAgeRangeDto>> GetExpiredLayawaysByAgeAsync(CancellationToken cancellationToken = default);
    Task<SalesForecastResponseDto> GetSalesForecastAsync(string period = "month", CancellationToken cancellationToken = default);
    Task<ProductAttributeBreakdownResponseDto> GetProductAttributeBreakdownAsync(string productName, string period = "month", string? attributeIds = null, CancellationToken cancellationToken = default);
    
    // BI Fase 1: Finanzas y Consolidación
    Task<IReadOnlyList<AovByBranchDto>> GetAovByBranchAsync(string period = "month", CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AgingReportDto>> GetAgingUnliquidatedAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PaymentMixDto>> GetPaymentMixAsync(string period = "month", CancellationToken cancellationToken = default);

    // BI Fase 2: Operaciones
    Task<IReadOnlyList<ManufacturingLeadTimeDto>> GetManufacturingLeadTimeAsync(string period = "month", CancellationToken cancellationToken = default);
    Task<OtifMetricsDto> GetOtifMetricsAsync(string period = "month", CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StageDwellTimeDto>> GetStageDwellTimesAsync(CancellationToken cancellationToken = default);
    Task<FulfillmentRatioDto> GetFulfillmentRatioAsync(string period = "month", CancellationToken cancellationToken = default);

    // BI Fase 3: Funnel y Ventas
    Task<ConversionRateDto> GetConversionRateAsync(string period = "month", CancellationToken cancellationToken = default);
    Task<ClosingVelocityDto> GetClosingVelocityAsync(string period = "month", CancellationToken cancellationToken = default);

    // BI Fase 4: Inventario y Reposición
    Task<IReadOnlyList<ReplenishmentSuggestionDto>> GetReplenishmentSuggestionsAsync(CancellationToken cancellationToken = default);
    Task<StockTurnoverDto> GetStockTurnoverAsync(CancellationToken cancellationToken = default);
    Task<StockoutRateDto> GetStockoutRateAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StoreOccupancyDto>> GetStoreOccupancyAsync(CancellationToken cancellationToken = default);

    // Aging Drill-down & Excel Export
    Task<IReadOnlyList<AgingOrderDetailDto>> GetAgingOrdersAsync(string type, string? range = null, CancellationToken cancellationToken = default);
    Task<byte[]> GenerateAgingOrdersExcelAsync(string type, string? range = null, CancellationToken cancellationToken = default);

    // KPI Drill-down & Excel Export
    Task<IReadOnlyList<AgingOrderDetailDto>> GetOrdersDrilldownAsync(string type, string period = "month", CancellationToken cancellationToken = default);
    Task<byte[]> GenerateOrdersDrilldownExcelAsync(string type, string period = "month", CancellationToken cancellationToken = default);
    Task<CollectedDrillDownResponseDto> GetCollectedDrilldownAsync(string period = "month", CancellationToken cancellationToken = default);
    Task<byte[]> GenerateCollectedDrilldownExcelAsync(string period = "month", string? tab = null, CancellationToken cancellationToken = default);
    Task<CasheaDrillDownResponseDto> GetCasheaDrilldownAsync(string period = "month", CancellationToken cancellationToken = default);
    Task<byte[]> GenerateCasheaDrilldownExcelAsync(string period = "month", CancellationToken cancellationToken = default);
}
