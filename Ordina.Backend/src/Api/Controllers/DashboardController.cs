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
        CancellationToken ct = default)
    {
        var metrics = await _dashboardService.GetDashboardMetricsAsync(period, ct);
        return Ok(metrics);
    }

    [HttpGet("trend")]
    public async Task<ActionResult<IReadOnlyList<TrendDataPointDto>>> GetTrend(
        [FromQuery] int days = 30,
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetSalesTrendAsync(Math.Clamp(days, 1, 1100), ct);
        return Ok(data);
    }

    [HttpGet("forecast")]
    public async Task<ActionResult<SalesForecastResponseDto>> GetForecast(
        [FromQuery] string period = "month",
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetSalesForecastAsync(period, ct);
        return Ok(data);
    }

    [HttpGet("by-sale-type")]
    public async Task<ActionResult<IReadOnlyList<SaleTypeDataDto>>> GetBySaleType(
        [FromQuery] string period = "month",
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetBySaleTypeAsync(period, ct);
        return Ok(data);
    }

    [HttpGet("top-sellers")]
    public async Task<ActionResult<IReadOnlyList<TopSellerDto>>> GetTopSellers(
        [FromQuery] string period = "month",
        [FromQuery] int limit = 10,
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetTopSellersAsync(period, Math.Clamp(limit, 1, 50), ct);
        return Ok(data);
    }

    [HttpGet("top-products")]
    public async Task<ActionResult<IReadOnlyList<TopProductDto>>> GetTopProducts(
        [FromQuery] string period = "month",
        [FromQuery] int limit = 10,
        CancellationToken ct = default)
    {
        var data = await _dashboardService.GetTopProductsAsync(period, Math.Clamp(limit, 1, 50), ct);
        return Ok(data);
    }

    [HttpGet("top-products/attribute-breakdown")]
    public async Task<ActionResult<ProductAttributeBreakdownResponseDto>> GetProductAttributeBreakdown(
        [FromQuery] string productName,
        [FromQuery] string period = "month",
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(productName))
            return BadRequest("El nombre del producto es requerido.");

        var data = await _dashboardService.GetProductAttributeBreakdownAsync(productName, period, ct);
        return Ok(data);
    }

    [HttpGet("pipeline")]
    public async Task<ActionResult<PipelineSnapshotDto>> GetPipeline(CancellationToken ct = default)
    {
        var data = await _dashboardService.GetPipelineSnapshotAsync(ct);
        return Ok(data);
    }

    [HttpGet("expired-layaways-by-age")]
    public async Task<ActionResult<IReadOnlyList<ExpiredLayawayAgeRangeDto>>> GetExpiredLayawaysByAge(CancellationToken ct = default)
    {
        var data = await _dashboardService.GetExpiredLayawaysByAgeAsync(ct);
        return Ok(data);
    }
}
