using Ordina.Database.Entities.Commission;

namespace Ordina.Database.Repositories;

public interface ISaleTypeCommissionRuleRepository
{
    Task<SaleTypeCommissionRule?> GetByIdAsync(string id);
    Task<SaleTypeCommissionRule?> GetBySaleTypeAsync(string saleType);
    Task<IEnumerable<SaleTypeCommissionRule>> GetAllAsync();
    Task<SaleTypeCommissionRule> CreateAsync(SaleTypeCommissionRule rule);
    Task<SaleTypeCommissionRule> UpdateAsync(SaleTypeCommissionRule rule);
    Task<SaleTypeCommissionRule> UpsertBySaleTypeAsync(SaleTypeCommissionRule rule);
    Task<bool> DeleteAsync(string id);
    Task<bool> DeleteBySaleTypeAsync(string saleType);
    Task<bool> ExistsAsync(string id);
    /// <param name="forceReset">Si es true, elimina todas las reglas existentes antes de sembrar los valores por defecto.</param>
    Task SeedDefaultRulesAsync(bool forceReset = false);
}
