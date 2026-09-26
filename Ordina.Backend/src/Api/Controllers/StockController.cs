using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Inventory;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StockController(
    IPhysicalStockService stockService,
    IStockReservationService reservationService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PhysicalStockDto>>> GetStockList(
        [FromQuery] string? locationId,
        [FromQuery] string? categoryId,
        [FromQuery] string? search,
        [FromQuery] bool? onlyAvailable,
        CancellationToken ct)
    {
        var list = await stockService.GetStockListAsync(locationId, categoryId, search, onlyAvailable, ct);
        return Ok(list);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<PhysicalStockDto>> GetById(string id, CancellationToken ct)
    {
        var item = await stockService.GetByIdAsync(id, ct);
        return item != null ? Ok(item) : NotFound();
    }

    [HttpPost("manual-entry")]
    public async Task<ActionResult<PhysicalStockDto>> AddManualStock([FromBody] ManualStockEntryDto dto, CancellationToken ct)
    {
        var item = await stockService.AddManualStockAsync(dto, ct);
        return Ok(item);
    }

    [HttpPost("import-excel")]
    public async Task<ActionResult<StockImportSummaryDto>> ImportExcel([FromForm] IFormFile file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest("No se proporcionó ningún archivo de Excel válido.");
        }

        using var stream = file.OpenReadStream();
        var summary = await stockService.ImportExcelAsync(stream, ct);
        return Ok(summary);
    }

    [HttpGet("import-template")]
    public async Task<IActionResult> DownloadTemplate(CancellationToken ct)
    {
        var bytes = await stockService.GenerateExcelTemplateAsync(ct);
        if (HttpContext != null)
        {
            Response.Headers["Content-Disposition"] = "attachment; filename=\"plantilla_inventario_camihogar.xlsx\"";
            Response.Headers.Append("Access-Control-Expose-Headers", "Content-Disposition");
        }
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }

    [HttpPost("reservations")]
    public async Task<ActionResult<StockReservationDto>> ReserveItem([FromBody] CreateStockReservationDto dto, CancellationToken ct)
    {
        try
        {
            var res = await reservationService.ReserveItemAsync(dto, ct);
            return Ok(res);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpGet("reservations/active")]
    public async Task<ActionResult<IReadOnlyList<StockReservationDto>>> GetActiveReservations([FromQuery] string? vendorId, CancellationToken ct) =>
        Ok(await reservationService.GetActiveReservationsAsync(vendorId, ct));

    [HttpGet("{stockId}/reservation")]
    public async Task<ActionResult<StockReservationDto>> GetActiveReservationByStockId(string stockId, CancellationToken ct)
    {
        var res = await reservationService.GetActiveReservationByStockIdAsync(stockId, ct);
        return res != null ? Ok(res) : NotFound();
    }

    [HttpPost("reservations/{id}/release")]
    public async Task<IActionResult> ReleaseReservation(string id, CancellationToken ct) =>
        await reservationService.ReleaseReservationAsync(id, ct) ? NoContent() : NotFound();

    [HttpPost("reservations/{id}/extend")]
    public async Task<ActionResult<StockReservationDto>> ExtendReservation(string id, [FromBody] ExtendStockReservationDto dto, CancellationToken ct)
    {
        var res = await reservationService.ExtendReservationAsync(id, dto.OrderNumber, ct);
        return res != null ? Ok(res) : NotFound();
    }

    [HttpPost("reservations/{id}/confirm")]
    public async Task<IActionResult> ConfirmReservation(string id, [FromBody] ConfirmStockReservationDto dto, CancellationToken ct)
    {
        var ok = await reservationService.ConfirmReservationAsync(id, dto.OrderNumber, ct);
        return ok ? Ok(new { success = true }) : BadRequest("No se pudo confirmar la reserva.");
    }
}
