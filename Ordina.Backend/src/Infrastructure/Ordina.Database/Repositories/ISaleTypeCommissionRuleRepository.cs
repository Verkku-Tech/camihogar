using Ordina.Database.Entities.Commission;

namespace Ordina.Database.Repositories;

public interface ISaleTypeCommissionRuleRepository
{
    Task<SaleTypeCommissionRule?> GetByIdAsync(string id);
    Task<SaleTypeCommissionRule?> GetBySaleTypeAndTierAsync(string saleType, decimal familyCommissionUsdPerUnit);
    Task<IReadOnlyList<SaleTypeCommissionRule>> GetAllBySaleTypeAsync(string saleType);
    Task<IEnumerable<SaleTypeCommissionRule>> GetAllAsync();
    Task<SaleTypeCommissionRule> CreateAsync(SaleTypeCommissionRule rule);
    Task<SaleTypeCommissionRule> UpdateAsync(SaleTypeCommissionRule rule);
    Task<SaleTypeCommissionRule> UpsertBySaleTypeAndTierAsync(SaleTypeCommissionRule rule);
    Task<bool> DeleteAsync(string id);
    /// <summary>Elimina todas las variantes por nivel de un tipo de venta.</summary>
    Task<long> DeleteAllBySaleTypeAsync(string saleType);
    Task<bool> ExistsAsync(string id);
    /// <param name="forceReset">Si es true, elimina todas las reglas existentes antes de sembrar los valores por defecto.</param>
    Task SeedDefaultRulesAsync(bool forceReset = false);
    /// <summary>Inserta solo las reglas (tipo + tier) que falten según el cuadro estándar.</summary>
    Task<int> EnsureMissingDefaultRulesAsync();
    Task<SaleTypeCommissionCompleteness> GetCompletenessAsync();
}
