using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Catalog;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CategoriesController : ControllerBase
{
    private readonly ICategoryService _categoryService;

    public CategoriesController(ICategoryService categoryService)
    {
        _categoryService = categoryService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoryResponseDto>>> GetAll(CancellationToken cancellationToken)
    {
        var result = await _categoryService.GetAllAsync(cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<CategoryResponseDto>> GetById(string id, CancellationToken cancellationToken)
    {
        var category = await _categoryService.GetByIdAsync(id, cancellationToken);
        if (category == null)
        {
            return NotFound();
        }
        return Ok(category);
    }

    [HttpPost]
    public async Task<ActionResult<CategoryResponseDto>> Create([FromBody] CreateCategoryDto dto, CancellationToken cancellationToken)
    {
        var created = await _categoryService.CreateAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<CategoryResponseDto>> Update(string id, [FromBody] UpdateCategoryDto dto, CancellationToken cancellationToken)
    {
        var updated = await _categoryService.UpdateAsync(id, dto, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var deleted = await _categoryService.DeleteAsync(id, cancellationToken);
        if (!deleted)
        {
            return NotFound();
        }
        return NoContent();
    }

    [HttpPost("bulk-delete")]
    public async Task<ActionResult<object>> BulkDelete([FromBody] BulkDeleteRequest request, CancellationToken cancellationToken)
    {
        var deleted = 0;
        var failed = 0;
        var errors = new List<string>();

        if (request?.Ids != null)
        {
            foreach (var id in request.Ids)
            {
                try
                {
                    var success = await _categoryService.DeleteAsync(id, cancellationToken);
                    if (success) deleted++;
                    else failed++;
                }
                catch (Exception ex)
                {
                    failed++;
                    errors.Add($"Error al eliminar categoría {id}: {ex.Message}");
                }
            }
        }

        return Ok(new { deleted, failed, errors });
    }
}
