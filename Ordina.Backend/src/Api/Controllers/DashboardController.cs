using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Dashboard;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet]
    [HttpGet("metrics")]
    public async Task<ActionResult<DashboardMetricsDto>> GetMetrics(
        [FromQuery] string period = "day",
        [FromQuery] string? storeIds = null,
        CancellationToken ct = default)
    {
        var metrics = await _dashboardService.GetDashboardMetricsAsync(period, storeIds, ct);
        return Ok(metrics);
    }

    [HttpGet("trend")]
    public async Task<ActionResult<IReadOnlyList<TrendDataPointDto>>> GetTrend(
        [FromQuery] int days = 30,
        [FromQuery] string? storeIds = null,
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetSalesTrendAsync(Math.Clamp(days, 1, 1100), storeIds, ct);
        return Ok(data);
    }

    [HttpGet("forecast")]
    public async Task<ActionResult<SalesForecastResponseDto>> GetForecast(
        [FromQuery] string period = "month",
        [FromQuery] int weekOffset = 0,
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetSalesForecastAsync(period, weekOffset, ct);
        return Ok(data);
    }

    [HttpGet("forecast/history")]
    public async Task<ActionResult<IReadOnlyList<SalesForecastHistoryItemDto>>> GetForecastHistory(
        [FromQuery] string? period = null,
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetForecastHistoryAsync(period, ct);
        return Ok(data);
    }

    [HttpGet("forecast/history/{id}")]
    public async Task<ActionResult<SalesForecastRecordDto>> GetForecastById(
        string id,
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetForecastByIdAsync(id, ct);
        if (data == null) return NotFound();
        return Ok(data);
    }

    [HttpGet("by-sale-type")]
    public async Task<ActionResult<IReadOnlyList<SaleTypeDataDto>>> GetBySaleType(
        [FromQuery] string period = "month",
        [FromQuery] string? storeIds = null,
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetBySaleTypeAsync(period, storeIds, ct);
        return Ok(data);
    }

    [HttpGet("top-sellers")]
    public async Task<ActionResult<IReadOnlyList<TopSellerDto>>> GetTopSellers(
        [FromQuery] string period = "month",
        [FromQuery] int limit = 10,
        [FromQuery] string? storeIds = null,
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetTopSellersAsync(period, Math.Clamp(limit, 1, 50), storeIds, ct);
        return Ok(data);
    }

    [HttpGet("top-products")]
    public async Task<ActionResult<IReadOnlyList<TopProductDto>>> GetTopProducts(
        [FromQuery] string period = "month",
        [FromQuery] int limit = 10,
        [FromQuery] string? storeIds = null,
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetTopProductsAsync(period, Math.Clamp(limit, 1, 50), storeIds, ct);
        return Ok(data);
    }

    [HttpGet("top-products/attribute-breakdown")]
    public async Task<ActionResult<ProductAttributeBreakdownResponseDto>> GetProductAttributeBreakdown(
        [FromQuery] string productName,
        [FromQuery] string period = "month",
        [FromQuery] string? attributeIds = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(productName))
            return BadRequest("El nombre del producto es requerido.");

        var data = await _dashboardService.GetProductAttributeBreakdownAsync(productName, period, attributeIds, ct);
        return Ok(data);
    }

    [HttpGet("pipeline")]
    public async Task<ActionResult<PipelineSnapshotDto>> GetPipeline(
        [FromQuery] string? storeIds = null,
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetPipelineSnapshotAsync(storeIds, ct);
        return Ok(data);
    }

    [HttpGet("expired-layaways-by-age")]
    public async Task<ActionResult<IReadOnlyList<ExpiredLayawayAgeRangeDto>>> GetExpiredLayawaysByAge(CancellationToken ct = default)
    {
        var data = await _dashboardService.GetExpiredLayawaysByAgeAsync(ct);
        return Ok(data);
    }

    // BI Fase 1: Finanzas y Consolidación
    [HttpGet("aov-by-branch")]
    public async Task<ActionResult<IReadOnlyList<AovByBranchDto>>> GetAovByBranch(
        [FromQuery] string period = "month",
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetAovByBranchAsync(period, ct);
        return Ok(data);
    }

    [HttpGet("aging-unliquidated")]
    public async Task<ActionResult<IReadOnlyList<AgingReportDto>>> GetAgingUnliquidated(CancellationToken ct = default)
    {
        var data = await _dashboardService.GetAgingUnliquidatedAsync(ct);
        return Ok(data);
    }

    [HttpGet("payment-mix")]
    public async Task<ActionResult<IReadOnlyList<PaymentMixDto>>> GetPaymentMix(
        [FromQuery] string period = "month",
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetPaymentMixAsync(period, ct);
        return Ok(data);
    }

    // BI Fase 2: Operaciones
    [HttpGet("manufacturing-lead-time")]
    public async Task<ActionResult<IReadOnlyList<ManufacturingLeadTimeDto>>> GetManufacturingLeadTime(
        [FromQuery] string period = "month",
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetManufacturingLeadTimeAsync(period, ct);
        return Ok(data);
    }

    [HttpGet("otif")]
    public async Task<ActionResult<OtifMetricsDto>> GetOtif(
        [FromQuery] string period = "month",
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetOtifMetricsAsync(period, ct);
        return Ok(data);
    }

    [HttpGet("stage-dwell-times")]
    public async Task<ActionResult<IReadOnlyList<StageDwellTimeDto>>> GetStageDwellTimes(CancellationToken ct = default)
    {
        var data = await _dashboardService.GetStageDwellTimesAsync(ct);
        return Ok(data);
    }

    [HttpGet("fulfillment-ratio")]
    public async Task<ActionResult<FulfillmentRatioDto>> GetFulfillmentRatio(
        [FromQuery] string period = "month",
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetFulfillmentRatioAsync(period, ct);
        return Ok(data);
    }

    // BI Fase 3: Funnel y Ventas
    [HttpGet("conversion-rate")]
    public async Task<ActionResult<ConversionRateDto>> GetConversionRate(
        [FromQuery] string period = "month",
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetConversionRateAsync(period, ct);
        return Ok(data);
    }

    [HttpGet("closing-velocity")]
    public async Task<ActionResult<ClosingVelocityDto>> GetClosingVelocity(
        [FromQuery] string period = "month",
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetClosingVelocityAsync(period, ct);
        return Ok(data);
    }

    // BI Fase 4: Inventario y Reposición
    [HttpGet("replenishment-suggestions")]
    public async Task<ActionResult<IReadOnlyList<ReplenishmentSuggestionDto>>> GetReplenishmentSuggestions(CancellationToken ct = default)
    {
        var data = await _dashboardService.GetReplenishmentSuggestionsAsync(ct);
        return Ok(data);
    }

    [HttpGet("stock-turnover")]
    public async Task<ActionResult<StockTurnoverDto>> GetStockTurnover(CancellationToken ct = default)
    {
        var data = await _dashboardService.GetStockTurnoverAsync(ct);
        return Ok(data);
    }

    [HttpGet("stockout-rate")]
    public async Task<ActionResult<StockoutRateDto>> GetStockoutRate(CancellationToken ct = default)
    {
        var data = await _dashboardService.GetStockoutRateAsync(ct);
        return Ok(data);
    }

    [HttpGet("store-occupancy")]
    public async Task<ActionResult<IReadOnlyList<StoreOccupancyDto>>> GetStoreOccupancy(CancellationToken ct = default)
    {
        var data = await _dashboardService.GetStoreOccupancyAsync(ct);
        return Ok(data);
    }

    // BI Drill-down y Exportación Excel
    [HttpGet("aging-orders")]
    public async Task<ActionResult<IReadOnlyList<AgingOrderDetailDto>>> GetAgingOrders(
        [FromQuery] string type = "unliquidated",
        [FromQuery] string? range = null,
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetAgingOrdersAsync(type, range, ct);
        return Ok(data);
    }

    [HttpGet("aging-orders/excel")]
    public async Task<IActionResult> DownloadAgingOrdersExcel(
        [FromQuery] string type = "unliquidated",
        [FromQuery] string? range = null,
        CancellationToken ct = default)
    {
        var fileBytes = await _dashboardService.GenerateAgingOrdersExcelAsync(type, range, ct);
        var filename = $"reporte_{(type == "expired_layaways" ? "apartados_vencidos" : "saldos_pendientes")}_{(string.IsNullOrEmpty(range) ? "todos" : range)}_{DateTime.UtcNow:yyyyMMdd_HHmm}.xlsx";
        return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename);
    }

    // Top KPIs Drill-down y Exportaciones Excel
    [HttpGet("drilldown/orders")]
    public async Task<ActionResult<IReadOnlyList<AgingOrderDetailDto>>> GetOrdersDrilldown(
        [FromQuery] string type = "orders",
        [FromQuery] string period = "month",
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetOrdersDrilldownAsync(type, period, ct);
        return Ok(data);
    }

    [HttpGet("drilldown/orders/excel")]
    public async Task<IActionResult> DownloadOrdersDrilldownExcel(
        [FromQuery] string type = "orders",
        [FromQuery] string period = "month",
        CancellationToken ct = default)
    {
        var fileBytes = await _dashboardService.GenerateOrdersDrilldownExcelAsync(type, period, ct);
        var filename = $"detalle_pedidos_{type}_{period}_{DateTime.UtcNow:yyyyMMdd_HHmm}.xlsx";
        return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename);
    }

    [HttpGet("drilldown/collected")]
    public async Task<ActionResult<CollectedDrillDownResponseDto>> GetCollectedDrilldown(
        [FromQuery] string period = "month",
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetCollectedDrilldownAsync(period, ct);
        return Ok(data);
    }

    [HttpGet("drilldown/collected/excel")]
    public async Task<IActionResult> DownloadCollectedDrilldownExcel(
        [FromQuery] string period = "month",
        [FromQuery] string? tab = null,
        CancellationToken ct = default)
    {
        var fileBytes = await _dashboardService.GenerateCollectedDrilldownExcelAsync(period, tab, ct);
        var filename = $"detalle_cobranza_{period}_{(string.IsNullOrEmpty(tab) ? "completo" : tab)}_{DateTime.UtcNow:yyyyMMdd_HHmm}.xlsx";
        return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename);
    }

    [HttpGet("drilldown/cashea")]
    public async Task<ActionResult<CasheaDrillDownResponseDto>> GetCasheaDrilldown(
        [FromQuery] string period = "month",
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetCasheaDrilldownAsync(period, ct);
        return Ok(data);
    }

    [HttpGet("drilldown/cashea/excel")]
    public async Task<IActionResult> DownloadCasheaDrilldownExcel(
        [FromQuery] string period = "month",
        CancellationToken ct = default)
    {
        var fileBytes = await _dashboardService.GenerateCasheaDrilldownExcelAsync(period, ct);
        var filename = $"detalle_cashea_{period}_{DateTime.UtcNow:yyyyMMdd_HHmm}.xlsx";
        return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename);
    }
}
