using Ordina.Database.Entities.Product;

namespace Ordina.Database.Repositories;

public interface IProductRepository
{
    Task<Product?> GetByIdAsync(string id);
    Task<IEnumerable<Product>> GetAllAsync();
    Task<IEnumerable<Product>> GetByCategoryIdAsync(string categoryId);
    Task<IEnumerable<Product>> GetByStatusAsync(string status);
    Task<Product?> GetBySkuAsync(string sku);
    Task<Product> CreateAsync(Product product);
    Task<Product> UpdateAsync(Product product);
    Task<bool> DeleteAsync(string id);
    Task<bool> ExistsAsync(string id);
    Task<bool> SkuExistsAsync(string sku);
}

