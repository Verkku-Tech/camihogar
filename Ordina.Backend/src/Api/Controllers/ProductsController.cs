using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Catalog;
using Ordina.Application.Common;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly IProductService _productService;

    public ProductsController(IProductService productService)
    {
        _productService = productService;
    }

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
        var result = await _productService.GetPagedAsync(request, cancellationToken);
        return Ok(result);
    }

    [HttpGet("all")]
    public async Task<ActionResult<IReadOnlyList<ProductResponseDto>>> GetAll(CancellationToken cancellationToken)
    {
        var result = await _productService.GetAllAsync(cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ProductResponseDto>> GetById(string id, CancellationToken cancellationToken)
    {
        var product = await _productService.GetByIdAsync(id, cancellationToken);
        if (product == null)
        {
            return NotFound();
        }
        return Ok(product);
    }

    [HttpGet("sku/{sku}")]
    public async Task<ActionResult<ProductResponseDto>> GetBySku(string sku, CancellationToken cancellationToken)
    {
        var product = await _productService.GetBySkuAsync(sku, cancellationToken);
        if (product == null)
        {
            return NotFound();
        }
        return Ok(product);
    }

    [HttpGet("category/{categoryId}")]
    public async Task<ActionResult<IReadOnlyList<ProductResponseDto>>> GetByCategory(string categoryId, CancellationToken cancellationToken)
    {
        var products = await _productService.GetByCategoryIdAsync(categoryId, cancellationToken);
        return Ok(products);
    }

    [HttpPost]
    public async Task<ActionResult<ProductResponseDto>> Create([FromBody] CreateProductDto dto, CancellationToken cancellationToken)
    {
        var created = await _productService.CreateAsync(dto, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ProductResponseDto>> Update(string id, [FromBody] UpdateProductDto dto, CancellationToken cancellationToken)
    {
        var updated = await _productService.UpdateAsync(id, dto, cancellationToken);
        return Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var deleted = await _productService.DeleteAsync(id, cancellationToken);
        if (!deleted)
        {
            return NotFound();
        }
        return NoContent();
    }
}
