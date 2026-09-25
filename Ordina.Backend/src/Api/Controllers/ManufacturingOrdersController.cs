using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Manufacturing;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/manufacturing-orders")]
[Authorize]
public class ManufacturingOrdersController(IManufacturingOrderService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ManufacturingOrderDto>>> GetAll(
        [FromQuery] string? status,
        [FromQuery] string? destinationLocationId,
        CancellationToken ct) =>
        Ok(await service.GetAllAsync(status, destinationLocationId, ct));

    [HttpGet("{id}")]
    public async Task<ActionResult<ManufacturingOrderDto>> GetById(string id, CancellationToken ct)
    {
        var item = await service.GetByIdAsync(id, ct);
        return item != null ? Ok(item) : NotFound();
    }

    [HttpPost]
    public async Task<ActionResult<ManufacturingOrderDto>> Create(
        [FromBody] CreateManufacturingOrderDto dto,
        CancellationToken ct)
    {
        var result = await service.CreateAsync(dto, ct);
        return Ok(result);
    }

    [HttpPut("{id}/status")]
    public async Task<ActionResult<ManufacturingOrderDto>> UpdateStatus(
        string id,
        [FromBody] UpdateManufacturingOrderStatusDto dto,
        CancellationToken ct)
    {
        var result = await service.UpdateStatusAsync(id, dto, ct);
        return result != null ? Ok(result) : NotFound();
    }

    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> Cancel(string id, CancellationToken ct)
    {
        var ok = await service.CancelAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }
}
