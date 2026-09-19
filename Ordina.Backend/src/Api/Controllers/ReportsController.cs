using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Reports;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;

    public ReportsController(IReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardMetricsDto>> GetDashboardMetrics(CancellationToken cancellationToken)
    {
        var metrics = await _reportService.GetDashboardMetricsAsync(cancellationToken);
        return Ok(metrics);
    }

    [HttpGet("commissions")]
    public async Task<ActionResult<IReadOnlyList<CommissionReportRowDto>>> GetCommissionsReport(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] string? vendorId = null,
        CancellationToken cancellationToken = default)
    {
        var report = await _reportService.GetCommissionReportAsync(from, to, vendorId, cancellationToken);
        return Ok(report);
    }

    [HttpGet("payments")]
    public async Task<ActionResult<IReadOnlyList<PaymentsDetailedReportRowDto>>> GetPaymentsReport(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        CancellationToken cancellationToken = default)
    {
        var report = await _reportService.GetPaymentsDetailedReportAsync(from, to, cancellationToken);
        return Ok(report);
    }
}
