using Microsoft.AspNetCore.Mvc;
using Ordina.Providers.Application.DTOs;
using Ordina.Providers.Application.Services;

namespace Ordina.Providers.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ProductsController : ControllerBase
{
    private readonly IProductService _productService;
    private readonly ILogger<ProductsController> _logger;

    public ProductsController(IProductService productService, ILogger<ProductsController> logger)
    {
        _productService = productService;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene todos los productos
    /// </summary>
    /// <returns>Lista de productos</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<ProductResponseDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<ProductResponseDto>>> GetAllProducts()
    {
        try
        {
            var products = await _productService.GetAllProductsAsync();
            return Ok(products);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener productos");
            return StatusCode(500, new { message = "Error interno del servidor al obtener productos" });
        }
    }

    /// <summary>
    /// Obtiene productos por categoría
    /// </summary>
    /// <param name="categoryId">ID de la categoría</param>
    /// <returns>Lista de productos de la categoría</returns>
    [HttpGet("category/{categoryId}")]
    [ProducesResponseType(typeof(IEnumerable<ProductResponseDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<ProductResponseDto>>> GetProductsByCategory(string categoryId)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(categoryId))
            {
                return BadRequest(new { message = "El ID de la categoría es requerido" });
            }

            var products = await _productService.GetProductsByCategoryIdAsync(categoryId);
            return Ok(products);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener productos por categoría {CategoryId}", categoryId);
            return StatusCode(500, new { message = "Error interno del servidor al obtener productos" });
        }
    }

    /// <summary>
    /// Obtiene productos por estado
    /// </summary>
    /// <param name="status">Estado del producto</param>
    /// <returns>Lista de productos con el estado</returns>
    [HttpGet("status/{status}")]
    [ProducesResponseType(typeof(IEnumerable<ProductResponseDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<ProductResponseDto>>> GetProductsByStatus(string status)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(status))
            {
                return BadRequest(new { message = "El estado es requerido" });
            }

            var products = await _productService.GetProductsByStatusAsync(status);
            return Ok(products);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener productos por estado {Status}", status);
            return StatusCode(500, new { message = "Error interno del servidor al obtener productos" });
        }
    }

    /// <summary>
    /// Obtiene un producto por su ID
    /// </summary>
    /// <param name="id">ID del producto</param>
    /// <returns>Producto encontrado</returns>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ProductResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductResponseDto>> GetProductById(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID del producto es requerido" });
            }

            var product = await _productService.GetProductByIdAsync(id);

            if (product == null)
            {
                return NotFound(new { message = $"Producto con ID {id} no encontrado" });
            }

            return Ok(product);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener producto con ID {ProductId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al obtener el producto" });
        }
    }

    /// <summary>
    /// Obtiene un producto por su SKU
    /// </summary>
    /// <param name="sku">SKU del producto</param>
    /// <returns>Producto encontrado</returns>
    [HttpGet("sku/{sku}")]
    [ProducesResponseType(typeof(ProductResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductResponseDto>> GetProductBySku(string sku)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(sku))
            {
                return BadRequest(new { message = "El SKU es requerido" });
            }

            var product = await _productService.GetProductBySkuAsync(sku);

            if (product == null)
            {
                return NotFound(new { message = $"Producto con SKU '{sku}' no encontrado" });
            }

            return Ok(product);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener producto con SKU {SKU}", sku);
            return StatusCode(500, new { message = "Error interno del servidor al obtener el producto" });
        }
    }

    /// <summary>
    /// Crea un nuevo producto
    /// </summary>
    /// <param name="createDto">Datos del producto a crear</param>
    /// <returns>Producto creado</returns>
    [HttpPost]
    [ProducesResponseType(typeof(ProductResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProductResponseDto>> CreateProduct([FromBody] CreateProductDto createDto)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var productDto = await _productService.CreateProductAsync(createDto);
            return CreatedAtAction(nameof(GetProductById), new { id = productDto.Id }, productDto);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear producto");
            return StatusCode(500, new { message = "Error interno del servidor al crear el producto" });
        }
    }

    /// <summary>
    /// Actualiza un producto existente
    /// </summary>
    /// <param name="id">ID del producto a actualizar</param>
    /// <param name="updateDto">Datos del producto a actualizar</param>
    /// <returns>Producto actualizado</returns>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ProductResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProductResponseDto>> UpdateProduct(string id, [FromBody] UpdateProductDto updateDto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID del producto es requerido" });
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var productDto = await _productService.UpdateProductAsync(id, updateDto);
            return Ok(productDto);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar producto con ID {ProductId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al actualizar el producto" });
        }
    }

    /// <summary>
    /// Elimina un producto
    /// </summary>
    /// <param name="id">ID del producto a eliminar</param>
    /// <returns>Confirmación de eliminación</returns>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteProduct(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID del producto es requerido" });
            }

            var deleted = await _productService.DeleteProductAsync(id);
            if (!deleted)
            {
                return NotFound(new { message = $"Producto con ID {id} no encontrado" });
            }

            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar producto con ID {ProductId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al eliminar el producto" });
        }
    }

    /// <summary>
    /// Verifica si un producto existe
    /// </summary>
    /// <param name="id">ID del producto</param>
    /// <returns>True si existe, false si no</returns>
    [HttpGet("{id}/exists")]
    [ProducesResponseType(typeof(bool), StatusCodes.Status200OK)]
    public async Task<ActionResult<bool>> ProductExists(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { message = "El ID del producto es requerido" });
            }

            var exists = await _productService.ProductExistsAsync(id);
            return Ok(exists);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar existencia del producto con ID {ProductId}", id);
            return StatusCode(500, new { message = "Error interno del servidor al verificar el producto" });
        }
    }

    /// <summary>
    /// Verifica si un SKU existe
    /// </summary>
    /// <param name="sku">SKU del producto</param>
    /// <returns>True si existe, false si no</returns>
    [HttpGet("sku/{sku}/exists")]
    [ProducesResponseType(typeof(bool), StatusCodes.Status200OK)]
    public async Task<ActionResult<bool>> SkuExists(string sku)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(sku))
            {
                return BadRequest(new { message = "El SKU es requerido" });
            }

            var exists = await _productService.SkuExistsAsync(sku);
            return Ok(exists);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar existencia del SKU {SKU}", sku);
            return StatusCode(500, new { message = "Error interno del servidor al verificar el SKU" });
        }
    }
}
