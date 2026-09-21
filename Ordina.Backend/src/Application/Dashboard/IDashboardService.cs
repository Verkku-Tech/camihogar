namespace Ordina.Application.Dashboard;

public interface IDashboardService
{
    Task<DashboardMetricsDto> GetDashboardMetricsAsync(string period = "day", CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TrendDataPointDto>> GetSalesTrendAsync(int days = 30, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SaleTypeDataDto>> GetBySaleTypeAsync(string period = "month", CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TopSellerDto>> GetTopSellersAsync(string period = "month", int limit = 10, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TopProductDto>> GetTopProductsAsync(string period = "month", int limit = 10, CancellationToken cancellationToken = default);
    Task<PipelineSnapshotDto> GetPipelineSnapshotAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ExpiredLayawayAgeRangeDto>> GetExpiredLayawaysByAgeAsync(CancellationToken cancellationToken = default);
    Task<SalesForecastResponseDto> GetSalesForecastAsync(string period = "month", CancellationToken cancellationToken = default);
    Task<ProductAttributeBreakdownResponseDto> GetProductAttributeBreakdownAsync(string productName, string period = "month", string? attributeIds = null, CancellationToken cancellationToken = default);
}
