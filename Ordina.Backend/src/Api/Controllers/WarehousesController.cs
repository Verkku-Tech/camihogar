using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Stores;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WarehousesController(IWarehouseService warehouseService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<WarehouseDto>>> GetAll(CancellationToken ct) =>
        Ok(await warehouseService.GetAllAsync(ct));

    [HttpGet("{id}")]
    public async Task<ActionResult<WarehouseDto>> GetById(string id, CancellationToken ct)
    {
        var res = await warehouseService.GetByIdAsync(id, ct);
        return res != null ? Ok(res) : NotFound();
    }

    [HttpPost]
    public async Task<ActionResult<WarehouseDto>> Create([FromBody] CreateWarehouseDto dto, CancellationToken ct) =>
        Ok(await warehouseService.CreateAsync(dto, ct));

    [HttpPut("{id}")]
    public async Task<ActionResult<WarehouseDto>> Update(string id, [FromBody] UpdateWarehouseDto dto, CancellationToken ct)
    {
        var res = await warehouseService.UpdateAsync(id, dto, ct);
        return res != null ? Ok(res) : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct) =>
        await warehouseService.DeleteAsync(id, ct) ? NoContent() : NotFound();
}
