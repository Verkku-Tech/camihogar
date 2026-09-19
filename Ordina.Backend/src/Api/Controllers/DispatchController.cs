using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Dispatch;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DispatchController : ControllerBase
{
    private readonly IDispatchService _dispatchService;

    public DispatchController(IDispatchService dispatchService)
    {
        _dispatchService = dispatchService;
    }

    [HttpGet("queue")]
    public async Task<ActionResult<IReadOnlyList<DispatchQueueItemDto>>> GetQueue([FromQuery] string? zone = null, CancellationToken cancellationToken = default)
    {
        var queue = await _dispatchService.GetDispatchQueueAsync(zone, cancellationToken);
        return Ok(queue);
    }

    [HttpGet("routes")]
    public async Task<ActionResult<IReadOnlyList<DispatchRouteResponseDto>>> GetRoutes(
        [FromQuery] DateTime? date = null,
        [FromQuery] string? zone = null,
        CancellationToken cancellationToken = default)
    {
        var routes = await _dispatchService.GetRoutesAsync(date, zone, cancellationToken);
        return Ok(routes);
    }

    [HttpGet("routes/{id}")]
    public async Task<ActionResult<DispatchRouteResponseDto>> GetRouteById(string id, CancellationToken cancellationToken)
    {
        var route = await _dispatchService.GetRouteByIdAsync(id, cancellationToken);
        if (route == null)
        {
            return NotFound();
        }
        return Ok(route);
    }

    [HttpPost("routes")]
    public async Task<ActionResult<DispatchRouteResponseDto>> CreateRoute([FromBody] CreateDispatchRouteDto dto, CancellationToken cancellationToken)
    {
        var created = await _dispatchService.CreateRouteAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetRouteById), new { id = created.Id }, created);
    }

    [HttpPut("routes/{id}")]
    public async Task<ActionResult<DispatchRouteResponseDto>> UpdateRoute(string id, [FromBody] UpdateDispatchRouteDto dto, CancellationToken cancellationToken)
    {
        var updated = await _dispatchService.UpdateRouteAsync(id, dto, cancellationToken);
        return Ok(updated);
    }

    [HttpPost("confirm-delivery")]
    public async Task<IActionResult> ConfirmDelivery([FromBody] ConfirmDeliveryDto dto, CancellationToken cancellationToken)
    {
        var success = await _dispatchService.ConfirmDeliveryAsync(dto, cancellationToken);
        if (!success)
        {
            return BadRequest(new { message = "Failed to confirm delivery. Route, order, or item not found." });
        }
        return NoContent();
    }

    [HttpDelete("routes/{id}")]
    public async Task<IActionResult> DeleteRoute(string id, CancellationToken cancellationToken)
    {
        var deleted = await _dispatchService.DeleteRouteAsync(id, cancellationToken);
        if (!deleted)
        {
            return NotFound();
        }
        return NoContent();
    }
}
