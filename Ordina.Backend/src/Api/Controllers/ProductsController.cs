using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Catalog;
using Ordina.Application.Common;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductsController(IProductService productService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<ProductResponseDto>>> GetPaged(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? searchTerm = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool isDescending = false,
        CancellationToken cancellationToken = default)
    {
        var request = new PagedRequest(Page: pageNumber, PageSize: pageSize, SearchTerm: searchTerm, SortBy: sortBy, SortDescending: isDescending);
        var result = await productService.GetPagedAsync(request, cancellationToken: cancellationToken);
        return Ok(result);
    }

    [HttpGet("paginated")]
    public async Task<ActionResult<object>> GetPaginated(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? categoryId = null,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        var request = new PagedRequest(Page: Math.Max(1, page), PageSize: Math.Clamp(pageSize, 1, 200), SearchTerm: search);
        var result = await productService.GetPagedAsync(request, categoryId, status, cancellationToken);
        
        var totalCount = result.TotalCount;
        var totalPages = pageSize > 0 ? (int)Math.Ceiling((double)totalCount / pageSize) : 1;

        return Ok(new
        {
            items = result.Items,
            totalCount,
            page,
            pageSize,
            totalPages,
            hasNextPage = page < totalPages,
            hasPreviousPage = page > 1
        });
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
                    var success = await productService.DeleteAsync(id, cancellationToken);
                    if (success) deleted++;
                    else failed++;
                }
                catch (Exception ex)
                {
                    failed++;
                    errors.Add($"Error al eliminar producto {id}: {ex.Message}");
                }
            }
        }

        return Ok(new { deleted, failed, errors });
    }

    [HttpGet("all")]
    public async Task<ActionResult<IReadOnlyList<ProductResponseDto>>> GetAll(CancellationToken cancellationToken)
    {
        var result = await productService.GetAllAsync(cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ProductResponseDto>> GetById(string id, CancellationToken cancellationToken)
    {
        var product = await productService.GetByIdAsync(id, cancellationToken);
        if (product == null)
        {
            return NotFound();
        }
        return Ok(product);
    }

    [HttpGet("sku/{sku}")]
    public async Task<ActionResult<ProductResponseDto>> GetBySku(string sku, CancellationToken cancellationToken)
    {
        var product = await productService.GetBySkuAsync(sku, cancellationToken);
        if (product == null)
        {
            return NotFound();
        }
        return Ok(product);
    }

    [HttpGet("category/{categoryId}")]
    public async Task<ActionResult<IReadOnlyList<ProductResponseDto>>> GetByCategory(string categoryId, CancellationToken cancellationToken)
    {
        var products = await productService.GetByCategoryIdAsync(categoryId, cancellationToken);
        return Ok(products);
    }

    [HttpPost]
    public async Task<ActionResult<ProductResponseDto>> Create([FromBody] CreateProductDto dto, CancellationToken cancellationToken)
    {
        var created = await productService.CreateAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ProductResponseDto>> Update(string id, [FromBody] UpdateProductDto dto, CancellationToken cancellationToken)
    {
        var updated = await productService.UpdateAsync(id, dto, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var deleted = await productService.DeleteAsync(id, cancellationToken);
        if (!deleted)
        {
            return NotFound();
        }
        return NoContent();
    }
}

public record BulkDeleteRequest(IReadOnlyList<string>? Ids);
