using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Clients;
using Ordina.Application.Common;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ClientsController : ControllerBase
{
    private readonly IClientService _clientService;

    public ClientsController(IClientService clientService)
    {
        _clientService = clientService;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<ClientResponseDto>>> GetAll(
        [FromQuery] int? page = null,
        [FromQuery] int? pageNumber = null,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool isDescending = false,
        CancellationToken cancellationToken = default)
    {
        var curPage = page ?? pageNumber ?? 1;
        var querySearch = !string.IsNullOrWhiteSpace(search) ? search : searchTerm;
        var request = new PagedRequest(Page: Math.Max(1, curPage), PageSize: Math.Clamp(pageSize, 1, 1000), SearchTerm: querySearch, SortBy: sortBy, SortDescending: isDescending);
        var result = await _clientService.GetAllAsync(request, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ClientResponseDto>> GetById(string id, CancellationToken cancellationToken)
    {
        var client = await _clientService.GetByIdAsync(id, cancellationToken);
        if (client == null)
        {
            return NotFound();
        }
        return Ok(client);
    }

    [HttpGet("rut/{rutId}")]
    public async Task<ActionResult<ClientResponseDto>> GetByRut(string rutId, CancellationToken cancellationToken)
    {
        var client = await _clientService.GetByRutIdAsync(rutId, cancellationToken);
        if (client == null)
        {
            return NotFound();
        }
        return Ok(client);
    }

    [HttpPost]
    public async Task<ActionResult<ClientResponseDto>> Create([FromBody] CreateClientDto dto, CancellationToken cancellationToken)
    {
        var created = await _clientService.CreateAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ClientResponseDto>> Update(string id, [FromBody] UpdateClientDto dto, CancellationToken cancellationToken)
    {
        var updated = await _clientService.UpdateAsync(id, dto, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var deleted = await _clientService.DeleteAsync(id, cancellationToken);
        if (!deleted)
        {
            return NotFound();
        }
        return NoContent();
    }

    [HttpPost("import-csv")]
    public async Task<ActionResult<ImportClientsResultDto>> ImportCsv(IFormFile file, CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "No CSV file provided." });
        }

        using var stream = file.OpenReadStream();
        var result = await _clientService.ImportClientsFromCsvAsync(stream, cancellationToken);
        return Ok(result);
    }
}
