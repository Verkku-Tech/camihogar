using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Common;
using Ordina.Application.Reports;
using Ordina.Domain.Orders;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;
    private readonly IOrderRepository _orderRepository;

    public ReportsController(IReportService reportService, IOrderRepository orderRepository)
    {
        _reportService = reportService;
        _orderRepository = orderRepository;
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
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] string? vendorId = null,
        CancellationToken cancellationToken = default)
    {
        var fromDate = startDate ?? from;
        var toDate = endDate ?? to;
        var report = await _reportService.GetCommissionReportAsync(fromDate, toDate, vendorId, cancellationToken);
        return Ok(report);
    }

    [HttpGet("commission-referrers")]
    [HttpGet("commissionreferrers")]
    public async Task<ActionResult<IEnumerable<object>>> GetCommissionReferrers(
        [FromQuery] string? startDate = null,
        [FromQuery] string? endDate = null,
        CancellationToken cancellationToken = default)
    {
        var orders = await _orderRepository.GetAllAsync(cancellationToken);
        var referrers = orders
            .Where(o => !string.IsNullOrWhiteSpace(o.ReferrerId) || !string.IsNullOrWhiteSpace(o.ReferrerName))
            .Select(o => new { id = o.ReferrerId ?? o.ReferrerName, name = o.ReferrerName ?? o.ReferrerId })
            .DistinctBy(r => r.id)
            .ToList();
        return Ok(referrers);
    }

    [HttpGet("commissions/excel")]
    public async Task<IActionResult> DownloadCommissionsReportExcel(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] string? vendorId = null,
        CancellationToken cancellationToken = default)
    {
        var bytes = await _reportService.GenerateCommissionsReportExcelAsync(from, to, vendorId, cancellationToken);
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"Reporte_Comisiones_{DateTime.UtcNow:yyyyMMdd}.xlsx");
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

    [HttpGet("payments/excel")]
    public async Task<IActionResult> DownloadPaymentsReportExcel(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        CancellationToken cancellationToken = default)
    {
        var bytes = await _reportService.GeneratePaymentsReportExcelAsync(from, to, cancellationToken);
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"Reporte_Pagos_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    [HttpGet("dispatch/excel")]
    public async Task<IActionResult> DownloadDispatchReportExcel(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        CancellationToken cancellationToken = default)
    {
        var bytes = await _reportService.GenerateDispatchReportExcelAsync(from, to, cancellationToken);
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"Reporte_Despachos_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    [HttpGet("manufacturing/excel")]
    [HttpGet("manufacturing")]
    public async Task<IActionResult> DownloadManufacturingReportExcel(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        var bytes = await _reportService.GenerateManufacturingReportExcelAsync(from, to, status, cancellationToken);
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"Reporte_Fabricacion_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    [HttpGet("expired-layaways/excel")]
    public async Task<IActionResult> DownloadExpiredLayawaysReportExcel(CancellationToken cancellationToken = default)
    {
        var bytes = await _reportService.GenerateExpiredLayawaysReportExcelAsync(cancellationToken);
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"Reporte_SA_Vencidos_{DateTime.UtcNow:yyyyMMdd}.xlsx");
    }

    [HttpGet("manufacturing/preview")]
    public async Task<ActionResult<IReadOnlyList<ManufacturingReportPreviewDto>>> GetManufacturingPreview(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] string? status = null,
        [FromQuery] string? manufacturerId = null,
        [FromQuery] string? orderNumber = null,
        CancellationToken cancellationToken = default)
    {
        var fromDate = startDate ?? from;
        var toDate = endDate ?? to;
        var preview = await _reportService.GetManufacturingPreviewAsync(fromDate, toDate, status, manufacturerId, orderNumber, cancellationToken);
        return Ok(preview);
    }

    [HttpGet("dispatch/preview")]
    public async Task<ActionResult<IReadOnlyList<DispatchReportPreviewDto>>> GetDispatchPreview(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] string? deliveryZone = null,
        [FromQuery] string? location = null,
        CancellationToken cancellationToken = default)
    {
        var fromDate = startDate ?? from;
        var toDate = endDate ?? to;
        var preview = await _reportService.GetDispatchPreviewAsync(fromDate, toDate, deliveryZone, location, cancellationToken);
        return Ok(preview);
    }
}

