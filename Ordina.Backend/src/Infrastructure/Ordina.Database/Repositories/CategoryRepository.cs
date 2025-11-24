using MongoDB.Driver;
using Ordina.Database.Entities.Category;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class CategoryRepository : ICategoryRepository
{
    private readonly IMongoCollection<Category> _collection;

    public CategoryRepository(MongoDbContext context)
    {
        _collection = context.Categories;
    }

    public async Task<Category?> GetByIdAsync(string id)
    {
        return await _collection.Find(c => c.Id == id).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<Category>> GetAllAsync()
    {
        return await _collection.Find(_ => true).ToListAsync();
    }

    public async Task<Category?> GetByNameAsync(string name)
    {
        return await _collection.Find(c => c.Name == name).FirstOrDefaultAsync();
    }

    public async Task<Category> CreateAsync(Category category)
    {
        await _collection.InsertOneAsync(category);
        return category;
    }

    public async Task<Category> UpdateAsync(Category category)
    {
        category.UpdatedAt = DateTime.UtcNow;
        await _collection.ReplaceOneAsync(c => c.Id == category.Id, category);
        return category;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _collection.DeleteOneAsync(c => c.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<bool> ExistsAsync(string id)
    {
        var count = await _collection.CountDocumentsAsync(c => c.Id == id);
        return count > 0;
    }
}

