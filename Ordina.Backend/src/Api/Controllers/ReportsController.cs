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


    [HttpGet("commissions")]
    [HttpGet("commissions/preview")]
    public async Task<ActionResult<IReadOnlyList<CommissionReportRowDto>>> GetCommissionsReport(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] string? vendorId = null,
        [FromQuery] string? storeId = null,
        [FromQuery] string? sellerType = null,
        [FromQuery] string? referrerId = null,
        CancellationToken cancellationToken = default)
    {
        var fromDate = startDate ?? from;
        var toDate = endDate ?? to;
        var report = await _reportService.GetCommissionReportAsync(
            fromDate,
            toDate,
            vendorId,
            storeId,
            sellerType,
            referrerId,
            cancellationToken);
        return Ok(report);
    }

    [HttpGet("commission-referrers")]
    [HttpGet("commissionreferrers")]
    [HttpGet("commissions/referrers")]
    public async Task<ActionResult<IReadOnlyList<CommissionReferrerOptionDto>>> GetCommissionReferrers(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        CancellationToken cancellationToken = default)
    {
        var start = startDate ?? from;
        var end = endDate ?? to;
        var referrers = await _reportService.GetCommissionReferrersInRangeAsync(start, end, cancellationToken);
        return Ok(referrers);
    }

    [HttpGet("commissions/excel")]
    public async Task<IActionResult> DownloadCommissionsReportExcel(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] string? vendorId = null,
        [FromQuery] string? storeId = null,
        [FromQuery] string? sellerType = null,
        [FromQuery] string? referrerId = null,
        CancellationToken cancellationToken = default)
    {
        var fromDate = startDate ?? from;
        var toDate = endDate ?? to;
        var bytes = await _reportService.GenerateCommissionsReportExcelAsync(
            fromDate,
            toDate,
            vendorId,
            storeId,
            sellerType,
            referrerId,
            cancellationToken);
        return ExcelFile(bytes, $"ReporteComisiones_{DateTime.UtcNow:dd-MM-yyyy}.xlsx");
    }

    [HttpGet("payments")]
    [HttpGet("payments/preview")]
    public async Task<ActionResult<IReadOnlyList<PaymentReportRowDto>>> GetPaymentsReport(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] string? paymentMethod = null,
        [FromQuery] string? accountId = null,
        CancellationToken cancellationToken = default)
    {
        var start = startDate ?? from;
        var end = endDate ?? to;
        var report = await _reportService.GetPaymentsReportDataAsync(start, end, paymentMethod, accountId, cancellationToken);
        return Ok(report);
    }

    [HttpGet("payments/excel")]
    public async Task<IActionResult> DownloadPaymentsReportExcel(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] string? paymentMethod = null,
        [FromQuery] string? accountId = null,
        CancellationToken cancellationToken = default)
    {
        var start = startDate ?? from;
        var end = endDate ?? to;
        var bytes = await _reportService.GeneratePaymentsReportExcelAsync(start, end, paymentMethod, accountId, cancellationToken);
        return ExcelFile(bytes, $"ReportePagos_{DateTime.UtcNow:dd-MM-yyyy}.xlsx");
    }

    [HttpGet("dispatch/excel")]
    public async Task<IActionResult> DownloadDispatchReportExcel(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        CancellationToken cancellationToken = default)
    {
        var bytes = await _reportService.GenerateDispatchReportExcelAsync(from, to, cancellationToken);
        return ExcelFile(bytes, $"ReporteDespachos_{DateTime.UtcNow:dd-MM-yyyy}.xlsx");
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
        return ExcelFile(bytes, $"ReporteFabricacion_{DateTime.UtcNow:dd-MM-yyyy}.xlsx");
    }

    [HttpGet("expired-layaways/excel")]
    public async Task<IActionResult> DownloadExpiredLayawaysReportExcel(CancellationToken cancellationToken = default)
    {
        var bytes = await _reportService.GenerateExpiredLayawaysReportExcelAsync(cancellationToken);
        return ExcelFile(bytes, $"ReporteSAVencidos_{DateTime.UtcNow:dd-MM-yyyy}.xlsx");
    }

    private IActionResult ExcelFile(byte[] bytes, string filename)
    {
        if (HttpContext != null)
        {
            Response.Headers["Content-Disposition"] = $"attachment; filename=\"{filename}\"";
            Response.Headers.Append("Access-Control-Expose-Headers", "Content-Disposition");
        }
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
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

