using Ordina.Database.Entities.Commission;

namespace Ordina.Database.Repositories;

public interface IProductCommissionRepository
{
    Task<ProductCommission?> GetByIdAsync(string id);
    Task<ProductCommission?> GetByCategoryIdAsync(string categoryId);
    Task<ProductCommission?> GetByCategoryNameAsync(string categoryName);
    Task<IEnumerable<ProductCommission>> GetAllAsync();
    Task<ProductCommission> CreateAsync(ProductCommission commission);
    Task<ProductCommission> UpdateAsync(ProductCommission commission);
    Task<ProductCommission> UpsertByCategoryAsync(ProductCommission commission);
    Task<bool> DeleteAsync(string id);
    Task<bool> DeleteByCategoryIdAsync(string categoryId);
    Task<bool> ExistsAsync(string id);
}
