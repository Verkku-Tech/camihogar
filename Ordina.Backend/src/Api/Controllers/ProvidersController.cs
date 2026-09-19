using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Catalog;
using Ordina.Application.Common;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProvidersController : ControllerBase
{
    private readonly IProviderService _providerService;

    public ProvidersController(IProviderService providerService)
    {
        _providerService = providerService;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<ProviderResponseDto>>> GetPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool isDescending = false,
        CancellationToken cancellationToken = default)
    {
        var request = new PagedRequest(Page: pageNumber, PageSize: pageSize, SearchTerm: searchTerm, SortBy: sortBy, SortDescending: isDescending);
        var result = await _providerService.GetPagedAsync(request, cancellationToken);
        return Ok(result);
    }

    [HttpGet("all")]
    public async Task<ActionResult<IReadOnlyList<ProviderResponseDto>>> GetAll(CancellationToken cancellationToken)
    {
        var result = await _providerService.GetAllAsync(cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ProviderResponseDto>> GetById(string id, CancellationToken cancellationToken)
    {
        var provider = await _providerService.GetByIdAsync(id, cancellationToken);
        if (provider == null)
        {
            return NotFound();
        }
        return Ok(provider);
    }

    [HttpPost]
    public async Task<ActionResult<ProviderResponseDto>> Create([FromBody] CreateProviderDto dto, CancellationToken cancellationToken)
    {
        var created = await _providerService.CreateAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ProviderResponseDto>> Update(string id, [FromBody] UpdateProviderDto dto, CancellationToken cancellationToken)
    {
        var updated = await _providerService.UpdateAsync(id, dto, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var deleted = await _providerService.DeleteAsync(id, cancellationToken);
        if (!deleted)
        {
            return NotFound();
        }
        return NoContent();
    }
}
