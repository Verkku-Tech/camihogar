using Ordina.Database.Entities.Category;

namespace Ordina.Database.Repositories;

public interface ICategoryRepository
{
    Task<Category?> GetByIdAsync(string id);
    Task<IEnumerable<Category>> GetAllAsync();
    Task<Category?> GetByNameAsync(string name);
    Task<Category> CreateAsync(Category category);
    Task<Category> UpdateAsync(Category category);
    Task<bool> DeleteAsync(string id);
    Task<long> DeleteManyAsync(IEnumerable<string> ids);
    Task<bool> ExistsAsync(string id);
}

