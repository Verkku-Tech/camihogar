using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ordina.Application.Common;
using Ordina.Domain.Common;
using Ordina.Domain.Finance;

namespace Ordina.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CommissionSettingsController : ControllerBase
{
    private readonly IRepository<ProductCommission> _productCommissionRepo;
    private readonly IRepository<SaleTypeCommissionRule> _saleTypeRuleRepo;
    private readonly ILogger<CommissionSettingsController> _logger;

    public CommissionSettingsController(
        IRepository<ProductCommission> productCommissionRepo,
        IRepository<SaleTypeCommissionRule> saleTypeRuleRepo,
        ILogger<CommissionSettingsController> logger)
    {
        _productCommissionRepo = productCommissionRepo;
        _saleTypeRuleRepo = saleTypeRuleRepo;
        _logger = logger;
    }

    #region Product Commissions

    [HttpGet("ProductCommissions")]
    public async Task<ActionResult<IEnumerable<object>>> GetProductCommissions(CancellationToken cancellationToken)
    {
        var list = await _productCommissionRepo.GetAllAsync(cancellationToken);
        return Ok(list.Select(p => new
        {
            id = p.Id,
            categoryId = p.CategoryId,
            categoryName = p.CategoryName,
            commissionValue = p.CommissionValue,
            createdAt = p.CreatedAt
        }));
    }

    [HttpGet("ProductCommissions/{categoryId}")]
    public async Task<ActionResult<object>> GetProductCommissionByCategory(string categoryId, CancellationToken cancellationToken)
    {
        var found = await _productCommissionRepo.FindAsync(p => p.CategoryId == categoryId, cancellationToken);
        var item = found.FirstOrDefault();
        if (item == null) return NotFound(new { message = $"No se encontró comisión para categoría {categoryId}" });

        return Ok(new
        {
            id = item.Id,
            categoryId = item.CategoryId,
            categoryName = item.CategoryName,
            commissionValue = item.CommissionValue,
            createdAt = item.CreatedAt
        });
    }

    [HttpPost("ProductCommissions")]
    public async Task<ActionResult<object>> UpsertProductCommission([FromBody] UpsertProductCommissionDto dto, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dto.CategoryId))
            return BadRequest(new { message = "El ID de la categoría es requerido" });

        var existing = (await _productCommissionRepo.FindAsync(p => p.CategoryId == dto.CategoryId, cancellationToken)).FirstOrDefault();
        if (existing != null)
        {
            existing.CategoryName = dto.CategoryName ?? existing.CategoryName;
            existing.CommissionValue = dto.CommissionValue;
            existing.UpdatedAt = DateTime.UtcNow;
            await _productCommissionRepo.UpdateAsync(existing, cancellationToken);
            return Ok(existing);
        }

        var created = new ProductCommission
        {
            CategoryId = dto.CategoryId,
            CategoryName = dto.CategoryName ?? string.Empty,
            CommissionValue = dto.CommissionValue,
            CreatedAt = DateTime.UtcNow
        };
        await _productCommissionRepo.AddAsync(created, cancellationToken);
        return Ok(created);
    }

    [HttpPost("ProductCommissions/Batch")]
    public async Task<ActionResult<IEnumerable<object>>> BatchUpsertProductCommissions([FromBody] List<UpsertProductCommissionDto> dtos, CancellationToken cancellationToken)
    {
        var results = new List<object>();
        foreach (var dto in dtos)
        {
            if (string.IsNullOrWhiteSpace(dto.CategoryId)) continue;
            var existing = (await _productCommissionRepo.FindAsync(p => p.CategoryId == dto.CategoryId, cancellationToken)).FirstOrDefault();
            if (existing != null)
            {
                existing.CategoryName = dto.CategoryName ?? existing.CategoryName;
                existing.CommissionValue = dto.CommissionValue;
                existing.UpdatedAt = DateTime.UtcNow;
                await _productCommissionRepo.UpdateAsync(existing, cancellationToken);
                results.Add(existing);
            }
            else
            {
                var created = new ProductCommission
                {
                    CategoryId = dto.CategoryId,
                    CategoryName = dto.CategoryName ?? string.Empty,
                    CommissionValue = dto.CommissionValue,
                    CreatedAt = DateTime.UtcNow
                };
                await _productCommissionRepo.AddAsync(created, cancellationToken);
                results.Add(created);
            }
        }
        return Ok(results);
    }

    [HttpDelete("ProductCommissions/{categoryId}")]
    public async Task<IActionResult> DeleteProductCommission(string categoryId, CancellationToken cancellationToken)
    {
        var existing = (await _productCommissionRepo.FindAsync(p => p.CategoryId == categoryId, cancellationToken)).FirstOrDefault();
        if (existing == null) return NotFound(new { message = "Comisión de producto no encontrada" });

        await _productCommissionRepo.DeleteAsync(existing.Id, cancellationToken);
        return NoContent();
    }

    #endregion

    #region Sale Type Rules

    [HttpGet("SaleTypeRules")]
    public async Task<ActionResult<IEnumerable<object>>> GetSaleTypeRules(CancellationToken cancellationToken)
    {
        var list = await _saleTypeRuleRepo.GetAllAsync(cancellationToken);
        return Ok(list.Select(MapSaleTypeRule));
    }

    [HttpGet("SaleTypeRules/{saleType}")]
    public async Task<ActionResult<IEnumerable<object>>> GetSaleTypeRulesByType(string saleType, CancellationToken cancellationToken)
    {
        var list = await _saleTypeRuleRepo.FindAsync(r => r.SaleType.ToLower() == saleType.ToLower(), cancellationToken);
        if (!list.Any()) return NotFound(new { message = $"No se encontró regla para {saleType}" });

        return Ok(list.Select(MapSaleTypeRule));
    }

    [HttpPost("SaleTypeRules")]
    public async Task<ActionResult<object>> UpsertSaleTypeRule([FromBody] UpsertSaleTypeRuleDto dto, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(dto.SaleType))
            return BadRequest(new { message = "El tipo de venta es requerido" });

        var existing = (await _saleTypeRuleRepo.FindAsync(
            r => r.SaleType.ToLower() == dto.SaleType.Trim().ToLower() && r.FamilyCommissionUsdPerUnit == dto.FamilyCommissionUsdPerUnit,
            cancellationToken)).FirstOrDefault();

        if (existing != null)
        {
            existing.SaleTypeLabel = dto.SaleTypeLabel ?? existing.SaleTypeLabel;
            existing.VendorRate = dto.VendorRate;
            existing.ReferrerRate = dto.ReferrerRate;
            existing.PostventaRate = dto.PostventaRate ?? existing.PostventaRate;
            existing.UpdatedAt = DateTime.UtcNow;
            await _saleTypeRuleRepo.UpdateAsync(existing, cancellationToken);
            return Ok(MapSaleTypeRule(existing));
        }

        var created = new SaleTypeCommissionRule
        {
            SaleType = dto.SaleType.Trim(),
            SaleTypeLabel = dto.SaleTypeLabel ?? dto.SaleType,
            FamilyCommissionUsdPerUnit = dto.FamilyCommissionUsdPerUnit,
            VendorRate = dto.VendorRate,
            ReferrerRate = dto.ReferrerRate,
            PostventaRate = dto.PostventaRate ?? 0,
            CreatedAt = DateTime.UtcNow
        };
        await _saleTypeRuleRepo.AddAsync(created, cancellationToken);
        return Ok(MapSaleTypeRule(created));
    }

    [HttpPost("SaleTypeRules/Batch")]
    public async Task<ActionResult<IEnumerable<object>>> BatchUpsertSaleTypeRules([FromBody] List<UpsertSaleTypeRuleDto> dtos, CancellationToken cancellationToken)
    {
        var results = new List<object>();
        foreach (var dto in dtos)
        {
            if (string.IsNullOrWhiteSpace(dto.SaleType)) continue;
            var existing = (await _saleTypeRuleRepo.FindAsync(
                r => r.SaleType.ToLower() == dto.SaleType.Trim().ToLower() && r.FamilyCommissionUsdPerUnit == dto.FamilyCommissionUsdPerUnit,
                cancellationToken)).FirstOrDefault();

            if (existing != null)
            {
                existing.SaleTypeLabel = dto.SaleTypeLabel ?? existing.SaleTypeLabel;
                existing.VendorRate = dto.VendorRate;
                existing.ReferrerRate = dto.ReferrerRate;
                existing.PostventaRate = dto.PostventaRate ?? existing.PostventaRate;
                existing.UpdatedAt = DateTime.UtcNow;
                await _saleTypeRuleRepo.UpdateAsync(existing, cancellationToken);
                results.Add(MapSaleTypeRule(existing));
            }
            else
            {
                var created = new SaleTypeCommissionRule
                {
                    SaleType = dto.SaleType.Trim(),
                    SaleTypeLabel = dto.SaleTypeLabel ?? dto.SaleType,
                    FamilyCommissionUsdPerUnit = dto.FamilyCommissionUsdPerUnit,
                    VendorRate = dto.VendorRate,
                    ReferrerRate = dto.ReferrerRate,
                    PostventaRate = dto.PostventaRate ?? 0,
                    CreatedAt = DateTime.UtcNow
                };
                await _saleTypeRuleRepo.AddAsync(created, cancellationToken);
                results.Add(MapSaleTypeRule(created));
            }
        }
        return Ok(results);
    }

    [HttpDelete("SaleTypeRules/{saleType}")]
    public async Task<IActionResult> DeleteSaleTypeRule(string saleType, CancellationToken cancellationToken)
    {
        var list = await _saleTypeRuleRepo.FindAsync(r => r.SaleType.ToLower() == saleType.ToLower(), cancellationToken);
        foreach (var item in list)
        {
            await _saleTypeRuleRepo.DeleteAsync(item.Id, cancellationToken);
        }
        return NoContent();
    }

    [HttpGet("SaleTypeRules/Completeness")]
    public async Task<ActionResult<object>> GetCompleteness(CancellationToken cancellationToken)
    {
        var rules = await _saleTypeRuleRepo.GetAllAsync(cancellationToken);
        return Ok(new
        {
            isComplete = rules.Count >= 21,
            expectedRuleCount = 21,
            actualRuleCount = rules.Count,
            hasLegacyTierZero = false,
            missingDescriptions = new List<string>()
        });
    }

    [HttpPost("SaleTypeRules/EnsureComplete")]
    public async Task<ActionResult<object>> EnsureComplete(CancellationToken cancellationToken)
    {
        var rules = await _saleTypeRuleRepo.GetAllAsync(cancellationToken);
        return Ok(new { inserted = 0, rules = rules.Select(MapSaleTypeRule) });
    }

    [HttpPost("SaleTypeRules/SeedDefaults")]
    public async Task<ActionResult<IEnumerable<object>>> SeedDefaults([FromQuery] bool force = false, CancellationToken cancellationToken = default)
    {
        var rules = await _saleTypeRuleRepo.GetAllAsync(cancellationToken);
        return Ok(rules.Select(MapSaleTypeRule));
    }

    #endregion

    private static object MapSaleTypeRule(SaleTypeCommissionRule r) => new
    {
        id = r.Id,
        saleType = r.SaleType,
        saleTypeLabel = r.SaleTypeLabel,
        familyCommissionUsdPerUnit = r.FamilyCommissionUsdPerUnit,
        vendorRate = r.VendorRate,
        referrerRate = r.ReferrerRate,
        postventaRate = r.PostventaRate,
        createdAt = r.CreatedAt,
        updatedAt = r.UpdatedAt
    };
}

public record UpsertProductCommissionDto(string CategoryId, string? CategoryName, decimal CommissionValue);
public record UpsertSaleTypeRuleDto(string SaleType, string? SaleTypeLabel, decimal FamilyCommissionUsdPerUnit, decimal VendorRate, decimal ReferrerRate, decimal? PostventaRate);
