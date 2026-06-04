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
            if (string.IsNullOrWhiteSpace(dto.CategoryId) && string.IsNullOrWhiteSpace(dto.CategoryName))
            {
                return BadRequest(new { message = "Se requiere categoryId o categoryName" });
            }

            var commission = new ProductCommission
            {
                CategoryId = string.IsNullOrWhiteSpace(dto.CategoryId)
                    ? (dto.CategoryName ?? string.Empty).Trim()
                    : dto.CategoryId.Trim(),
                CategoryName = (dto.CategoryName ?? string.Empty).Trim(),
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
                if (string.IsNullOrWhiteSpace(dto.CategoryId) && string.IsNullOrWhiteSpace(dto.CategoryName))
                    continue;

                var commission = new ProductCommission
                {
                    CategoryId = string.IsNullOrWhiteSpace(dto.CategoryId)
                        ? (dto.CategoryName ?? string.Empty).Trim()
                        : dto.CategoryId.Trim(),
                    CategoryName = (dto.CategoryName ?? string.Empty).Trim(),
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

    private static bool IsAllowedFamilyCommissionTier(decimal v) =>
        v == 2.5m || v == 5m || v == 7.5m;

    private static SaleTypeCommissionRuleDto MapSaleTypeRuleDto(SaleTypeCommissionRule r) => new()
    {
        Id = r.Id,
        SaleType = r.SaleType,
        SaleTypeLabel = r.SaleTypeLabel,
        FamilyCommissionUsdPerUnit = r.FamilyCommissionUsdPerUnit,
        VendorRate = r.VendorRate,
        ReferrerRate = r.ReferrerRate,
        PostventaRate = r.PostventaRate,
        CreatedAt = r.CreatedAt,
        UpdatedAt = r.UpdatedAt
    };

    /// <summary>
    /// Obtiene todas las reglas de distribución por tipo de venta (incluye una fila por nivel 2.5 / 5 / 7.5 USD/u).
    /// </summary>
    [HttpGet("SaleTypeRules")]
    [ProducesResponseType(typeof(IEnumerable<SaleTypeCommissionRuleDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<SaleTypeCommissionRuleDto>>> GetAllSaleTypeRules()
    {
        try
        {
            var rules = await _saleTypeCommissionRuleRepository.GetAllAsync();
            return Ok(rules.Select(MapSaleTypeRuleDto));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener reglas de tipo de venta");
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Obtiene todas las variantes por nivel (2.5, 5, 7.5 USD/u) de un tipo de venta.
    /// </summary>
    [HttpGet("SaleTypeRules/{saleType}")]
    [ProducesResponseType(typeof(IEnumerable<SaleTypeCommissionRuleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IEnumerable<SaleTypeCommissionRuleDto>>> GetSaleTypeRules(string saleType)
    {
        try
        {
            var list = await _saleTypeCommissionRuleRepository.GetAllBySaleTypeAsync(saleType);
            if (list.Count == 0)
            {
                return NotFound(new { message = $"No se encontró regla para el tipo de venta {saleType}" });
            }

            return Ok(list.Select(MapSaleTypeRuleDto));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener regla para tipo de venta {SaleType}", saleType);
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Crea o actualiza una regla de distribución (upsert por tipo de venta + USD/u familia).
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

            if (!IsAllowedFamilyCommissionTier(dto.FamilyCommissionUsdPerUnit))
            {
                return BadRequest(new { message = "familyCommissionUsdPerUnit debe ser 2.5, 5 o 7.5" });
            }

            var rule = new SaleTypeCommissionRule
            {
                SaleType = dto.SaleType.Trim(),
                SaleTypeLabel = dto.SaleTypeLabel,
                FamilyCommissionUsdPerUnit = dto.FamilyCommissionUsdPerUnit,
                VendorRate = dto.VendorRate,
                ReferrerRate = dto.ReferrerRate,
                PostventaRate = dto.PostventaRate
            };

            var result = await _saleTypeCommissionRuleRepository.UpsertBySaleTypeAndTierAsync(rule);

            return Ok(MapSaleTypeRuleDto(result));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear/actualizar regla de tipo de venta");
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Actualiza múltiples reglas en lote (upsert por tipo de venta + USD/u familia).
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

                if (!IsAllowedFamilyCommissionTier(dto.FamilyCommissionUsdPerUnit))
                {
                    return BadRequest(new { message = $"familyCommissionUsdPerUnit inválido para {dto.SaleType}" });
                }

                var rule = new SaleTypeCommissionRule
                {
                    SaleType = dto.SaleType.Trim(),
                    SaleTypeLabel = dto.SaleTypeLabel,
                    FamilyCommissionUsdPerUnit = dto.FamilyCommissionUsdPerUnit,
                    VendorRate = dto.VendorRate,
                    ReferrerRate = dto.ReferrerRate,
                    PostventaRate = dto.PostventaRate
                };

                var result = await _saleTypeCommissionRuleRepository.UpsertBySaleTypeAndTierAsync(rule);
                results.Add(MapSaleTypeRuleDto(result));
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
    /// Elimina todas las variantes por nivel de un tipo de venta.
    /// </summary>
    [HttpDelete("SaleTypeRules/{saleType}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteSaleTypeRule(string saleType)
    {
        try
        {
            var deleted = await _saleTypeCommissionRuleRepository.DeleteAllBySaleTypeAsync(saleType);
            if (deleted == 0)
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

    /// <summary>Indica si existen las 21 reglas (7 tipos × tiers 2.5/5/7.5).</summary>
    [HttpGet("SaleTypeRules/Completeness")]
    [ProducesResponseType(typeof(SaleTypeCommissionCompletenessDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<SaleTypeCommissionCompletenessDto>> GetSaleTypeRulesCompleteness()
    {
        try
        {
            var status = await _saleTypeCommissionRuleRepository.GetCompletenessAsync();
            return Ok(new SaleTypeCommissionCompletenessDto
            {
                IsComplete = status.IsComplete,
                ExpectedRuleCount = status.ExpectedRuleCount,
                ActualRuleCount = status.ActualRuleCount,
                HasLegacyTierZero = status.HasLegacyTierZero,
                MissingDescriptions = status.MissingDescriptions,
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar completitud de reglas");
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    /// <summary>Inserta reglas faltantes del cuadro estándar sin borrar las existentes.</summary>
    [HttpPost("SaleTypeRules/EnsureComplete")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<ActionResult<object>> EnsureSaleTypeRulesComplete()
    {
        try
        {
            var inserted = await _saleTypeCommissionRuleRepository.EnsureMissingDefaultRulesAsync();
            var rules = await _saleTypeCommissionRuleRepository.GetAllAsync();
            return Ok(new { inserted, rules = rules.Select(MapSaleTypeRuleDto) });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al completar reglas de tipo de venta");
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Inicializa las reglas por defecto (según el documento de especificaciones)
    /// </summary>
    [HttpPost("SaleTypeRules/SeedDefaults")]
    [ProducesResponseType(typeof(IEnumerable<SaleTypeCommissionRuleDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<SaleTypeCommissionRuleDto>>> SeedDefaultRules([FromQuery] bool force = false)
    {
        try
        {
            await _saleTypeCommissionRuleRepository.SeedDefaultRulesAsync(force);
            var rules = await _saleTypeCommissionRuleRepository.GetAllAsync();

            return Ok(rules.Select(MapSaleTypeRuleDto));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al inicializar reglas por defecto");
            return StatusCode(500, new { message = "Error interno del servidor" });
        }
    }

    #endregion
}
