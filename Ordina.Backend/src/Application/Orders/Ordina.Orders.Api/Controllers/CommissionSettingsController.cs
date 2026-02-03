using Microsoft.AspNetCore.Mvc;
using Ordina.Database.Entities.Commission;
using Ordina.Database.Repositories;
using Ordina.Orders.Application.DTOs;

namespace Ordina.Orders.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class CommissionSettingsController : ControllerBase
{
    private readonly IProductCommissionRepository _productCommissionRepository;
    private readonly ISaleTypeCommissionRuleRepository _saleTypeCommissionRuleRepository;
    private readonly ICategoryRepository _categoryRepository;
    private readonly ILogger<CommissionSettingsController> _logger;

    public CommissionSettingsController(
        IProductCommissionRepository productCommissionRepository,
        ISaleTypeCommissionRuleRepository saleTypeCommissionRuleRepository,
        ICategoryRepository categoryRepository,
        ILogger<CommissionSettingsController> logger)
    {
        _productCommissionRepository = productCommissionRepository;
        _saleTypeCommissionRuleRepository = saleTypeCommissionRuleRepository;
        _categoryRepository = categoryRepository;
        _logger = logger;
    }

    #region Product Commissions (Comisiones por Categoría/Familia)

    /// <summary>
    /// Obtiene todas las comisiones por categoría de producto
    /// </summary>
    [HttpGet("ProductCommissions")]
    [ProducesResponseType(typeof(IEnumerable<ProductCommissionDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<ProductCommissionDto>>> GetAllProductCommissions()
    {
        try
        {
            var commissions = await _productCommissionRepository.GetAllAsync();
            var dtos = commissions.Select(c => new ProductCommissionDto
            {
                Id = c.Id,
                CategoryId = c.CategoryId,
                CategoryName = c.CategoryName,
                CommissionValue = c.CommissionValue,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt
            });
            return Ok(dtos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener comisiones de producto");
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Obtiene la comisión de una categoría específica
    /// </summary>
    [HttpGet("ProductCommissions/{categoryId}")]
    [ProducesResponseType(typeof(ProductCommissionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductCommissionDto>> GetProductCommissionByCategory(string categoryId)
    {
        try
        {
            var commission = await _productCommissionRepository.GetByCategoryIdAsync(categoryId);
            if (commission == null)
            {
                return NotFound(new { message = $"No se encontró comisión para la categoría {categoryId}" });
            }

            return Ok(new ProductCommissionDto
            {
                Id = commission.Id,
                CategoryId = commission.CategoryId,
                CategoryName = commission.CategoryName,
                CommissionValue = commission.CommissionValue,
                CreatedAt = commission.CreatedAt,
                UpdatedAt = commission.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener comisión de producto para categoría {CategoryId}", categoryId);
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Crea o actualiza la comisión de una categoría (upsert)
    /// </summary>
    [HttpPost("ProductCommissions")]
    [ProducesResponseType(typeof(ProductCommissionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ProductCommissionDto>> UpsertProductCommission([FromBody] CreateProductCommissionDto dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.CategoryId))
            {
                return BadRequest(new { message = "El ID de la categoría es requerido" });
            }

            var commission = new ProductCommission
            {
                CategoryId = dto.CategoryId,
                CategoryName = dto.CategoryName,
                CommissionValue = dto.CommissionValue
            };

            var result = await _productCommissionRepository.UpsertByCategoryAsync(commission);

            return Ok(new ProductCommissionDto
            {
                Id = result.Id,
                CategoryId = result.CategoryId,
                CategoryName = result.CategoryName,
                CommissionValue = result.CommissionValue,
                CreatedAt = result.CreatedAt,
                UpdatedAt = result.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear/actualizar comisión de producto");
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Actualiza múltiples comisiones de producto en lote
    /// </summary>
    [HttpPost("ProductCommissions/Batch")]
    [ProducesResponseType(typeof(IEnumerable<ProductCommissionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IEnumerable<ProductCommissionDto>>> BatchUpsertProductCommissions([FromBody] List<CreateProductCommissionDto> dtos)
    {
        try
        {
            var results = new List<ProductCommissionDto>();

            foreach (var dto in dtos)
            {
                if (string.IsNullOrWhiteSpace(dto.CategoryId))
                    continue;

                var commission = new ProductCommission
                {
                    CategoryId = dto.CategoryId,
                    CategoryName = dto.CategoryName,
                    CommissionValue = dto.CommissionValue
                };

                var result = await _productCommissionRepository.UpsertByCategoryAsync(commission);
                results.Add(new ProductCommissionDto
                {
                    Id = result.Id,
                    CategoryId = result.CategoryId,
                    CategoryName = result.CategoryName,
                    CommissionValue = result.CommissionValue,
                    CreatedAt = result.CreatedAt,
                    UpdatedAt = result.UpdatedAt
                });
            }

            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar comisiones de producto en lote");
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Elimina la comisión de una categoría
    /// </summary>
    [HttpDelete("ProductCommissions/{categoryId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteProductCommission(string categoryId)
    {
        try
        {
            var deleted = await _productCommissionRepository.DeleteByCategoryIdAsync(categoryId);
            if (!deleted)
            {
                return NotFound(new { message = $"No se encontró comisión para la categoría {categoryId}" });
            }
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar comisión de producto para categoría {CategoryId}", categoryId);
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    #endregion

    #region Sale Type Commission Rules (Reglas de distribución por tipo de venta)

    /// <summary>
    /// Obtiene todas las reglas de distribución por tipo de venta
    /// </summary>
    [HttpGet("SaleTypeRules")]
    [ProducesResponseType(typeof(IEnumerable<SaleTypeCommissionRuleDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<SaleTypeCommissionRuleDto>>> GetAllSaleTypeRules()
    {
        try
        {
            var rules = await _saleTypeCommissionRuleRepository.GetAllAsync();
            var dtos = rules.Select(r => new SaleTypeCommissionRuleDto
            {
                Id = r.Id,
                SaleType = r.SaleType,
                SaleTypeLabel = r.SaleTypeLabel,
                VendorRate = r.VendorRate,
                ReferrerRate = r.ReferrerRate,
                CreatedAt = r.CreatedAt,
                UpdatedAt = r.UpdatedAt
            });
            return Ok(dtos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener reglas de tipo de venta");
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Obtiene una regla específica por tipo de venta
    /// </summary>
    [HttpGet("SaleTypeRules/{saleType}")]
    [ProducesResponseType(typeof(SaleTypeCommissionRuleDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SaleTypeCommissionRuleDto>> GetSaleTypeRule(string saleType)
    {
        try
        {
            var rule = await _saleTypeCommissionRuleRepository.GetBySaleTypeAsync(saleType);
            if (rule == null)
            {
                return NotFound(new { message = $"No se encontró regla para el tipo de venta {saleType}" });
            }

            return Ok(new SaleTypeCommissionRuleDto
            {
                Id = rule.Id,
                SaleType = rule.SaleType,
                SaleTypeLabel = rule.SaleTypeLabel,
                VendorRate = rule.VendorRate,
                ReferrerRate = rule.ReferrerRate,
                CreatedAt = rule.CreatedAt,
                UpdatedAt = rule.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener regla para tipo de venta {SaleType}", saleType);
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Crea o actualiza una regla de distribución (upsert)
    /// </summary>
    [HttpPost("SaleTypeRules")]
    [ProducesResponseType(typeof(SaleTypeCommissionRuleDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SaleTypeCommissionRuleDto>> UpsertSaleTypeRule([FromBody] CreateSaleTypeCommissionRuleDto dto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(dto.SaleType))
            {
                return BadRequest(new { message = "El tipo de venta es requerido" });
            }

            var rule = new SaleTypeCommissionRule
            {
                SaleType = dto.SaleType,
                SaleTypeLabel = dto.SaleTypeLabel,
                VendorRate = dto.VendorRate,
                ReferrerRate = dto.ReferrerRate
            };

            var result = await _saleTypeCommissionRuleRepository.UpsertBySaleTypeAsync(rule);

            return Ok(new SaleTypeCommissionRuleDto
            {
                Id = result.Id,
                SaleType = result.SaleType,
                SaleTypeLabel = result.SaleTypeLabel,
                VendorRate = result.VendorRate,
                ReferrerRate = result.ReferrerRate,
                CreatedAt = result.CreatedAt,
                UpdatedAt = result.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear/actualizar regla de tipo de venta");
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Actualiza múltiples reglas en lote
    /// </summary>
    [HttpPost("SaleTypeRules/Batch")]
    [ProducesResponseType(typeof(IEnumerable<SaleTypeCommissionRuleDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<SaleTypeCommissionRuleDto>>> BatchUpsertSaleTypeRules([FromBody] List<CreateSaleTypeCommissionRuleDto> dtos)
    {
        try
        {
            var results = new List<SaleTypeCommissionRuleDto>();

            foreach (var dto in dtos)
            {
                if (string.IsNullOrWhiteSpace(dto.SaleType))
                    continue;

                var rule = new SaleTypeCommissionRule
                {
                    SaleType = dto.SaleType,
                    SaleTypeLabel = dto.SaleTypeLabel,
                    VendorRate = dto.VendorRate,
                    ReferrerRate = dto.ReferrerRate
                };

                var result = await _saleTypeCommissionRuleRepository.UpsertBySaleTypeAsync(rule);
                results.Add(new SaleTypeCommissionRuleDto
                {
                    Id = result.Id,
                    SaleType = result.SaleType,
                    SaleTypeLabel = result.SaleTypeLabel,
                    VendorRate = result.VendorRate,
                    ReferrerRate = result.ReferrerRate,
                    CreatedAt = result.CreatedAt,
                    UpdatedAt = result.UpdatedAt
                });
            }

            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar reglas de tipo de venta en lote");
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Elimina una regla de distribución
    /// </summary>
    [HttpDelete("SaleTypeRules/{saleType}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteSaleTypeRule(string saleType)
    {
        try
        {
            var deleted = await _saleTypeCommissionRuleRepository.DeleteBySaleTypeAsync(saleType);
            if (!deleted)
            {
                return NotFound(new { message = $"No se encontró regla para el tipo de venta {saleType}" });
            }
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar regla para tipo de venta {SaleType}", saleType);
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Inicializa las reglas por defecto (según el documento de especificaciones)
    /// </summary>
    [HttpPost("SaleTypeRules/SeedDefaults")]
    [ProducesResponseType(typeof(IEnumerable<SaleTypeCommissionRuleDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<SaleTypeCommissionRuleDto>>> SeedDefaultRules()
    {
        try
        {
            await _saleTypeCommissionRuleRepository.SeedDefaultRulesAsync();
            var rules = await _saleTypeCommissionRuleRepository.GetAllAsync();
            
            var dtos = rules.Select(r => new SaleTypeCommissionRuleDto
            {
                Id = r.Id,
                SaleType = r.SaleType,
                SaleTypeLabel = r.SaleTypeLabel,
                VendorRate = r.VendorRate,
                ReferrerRate = r.ReferrerRate,
                CreatedAt = r.CreatedAt,
                UpdatedAt = r.UpdatedAt
            });
            
            return Ok(dtos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al inicializar reglas por defecto");
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    #endregion
}
