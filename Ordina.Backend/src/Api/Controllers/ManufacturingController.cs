using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Manufacturing;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ManufacturingController : ControllerBase
{
    private readonly IManufacturingService _manufacturingService;

    public ManufacturingController(IManufacturingService manufacturingService)
    {
        _manufacturingService = manufacturingService;
    }

    [HttpGet("kanban")]
    public async Task<ActionResult<KanbanBoardDto>> GetKanbanBoard([FromQuery] string? providerId = null, CancellationToken cancellationToken = default)
    {
        var board = await _manufacturingService.GetKanbanBoardAsync(providerId, cancellationToken);
        return Ok(board);
    }

    [HttpGet("items")]
    public async Task<ActionResult<IReadOnlyList<WorkOrderItemDto>>> GetItemsByStage([FromQuery] string stage, CancellationToken cancellationToken = default)
    {
        var items = await _manufacturingService.GetItemsByStageAsync(stage, cancellationToken);
        return Ok(items);
    }

    [HttpPatch("stage")]
    public async Task<IActionResult> UpdateStage([FromBody] UpdateManufacturingStageDto dto, CancellationToken cancellationToken)
    {
        var success = await _manufacturingService.UpdateStageAsync(dto, cancellationToken);
        if (!success)
        {
            return BadRequest(new { message = "Failed to update manufacturing stage. Order or product not found." });
        }
        return NoContent();
    }

    [HttpPost("refabricate")]
    public async Task<IActionResult> RefabricateProduct([FromBody] RefabricateProductDto dto, CancellationToken cancellationToken)
    {
        var success = await _manufacturingService.RefabricateProductAsync(dto, cancellationToken);
        if (!success)
        {
            return BadRequest(new { message = "Failed to register refabrication. Order or product not found." });
        }
        return NoContent();
    }

    [HttpGet("report")]
    public async Task<ActionResult<IReadOnlyList<ManufacturingReportRowDto>>> GetReport(
        [FromQuery] string? status = null,
        [FromQuery] string? manufacturerId = null,
        CancellationToken cancellationToken = default)
    {
        var report = await _manufacturingService.GetManufacturingReportAsync(status, manufacturerId, cancellationToken);
        return Ok(report);
    }
}
