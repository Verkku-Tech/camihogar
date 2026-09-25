using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Inventory;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/stock-transfers")]
[Authorize]
public class StockTransfersController(IStockTransferService transferService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StockTransferDto>>> GetAll(
        [FromQuery] string? status,
        [FromQuery] string? locationId,
        CancellationToken ct) =>
        Ok(await transferService.GetAllTransfersAsync(status, locationId, ct));

    [HttpGet("{id}")]
    public async Task<ActionResult<StockTransferDto>> GetById(string id, CancellationToken ct)
    {
        var item = await transferService.GetByIdAsync(id, ct);
        return item != null ? Ok(item) : NotFound();
    }

    [HttpPost]
    public async Task<ActionResult<StockTransferDto>> Create([FromBody] CreateStockTransferDto dto, CancellationToken ct)
    {
        try
        {
            var res = await transferService.CreateTransferAsync(dto, ct);
            return Ok(res);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/confirm")]
    public async Task<ActionResult<StockTransferDto>> Confirm(string id, [FromBody] ConfirmStockTransferDto dto, CancellationToken ct)
    {
        var userName = User.Identity?.Name ?? dto.TransferredBy ?? "Operador";
        var res = await transferService.ConfirmTransferAsync(id, userName, ct);
        return res != null ? Ok(res) : NotFound();
    }

    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> Cancel(string id, CancellationToken ct)
    {
        var ok = await transferService.CancelTransferAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }
}
