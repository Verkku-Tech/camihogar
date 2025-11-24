using MongoDB.Driver;
using Ordina.Database.Entities.Product;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class ProductRepository : IProductRepository
{
    private readonly IMongoCollection<Product> _collection;

    public ProductRepository(MongoDbContext context)
    {
        _collection = context.Products;
    }

    public async Task<Product?> GetByIdAsync(string id)
    {
        return await _collection.Find(p => p.Id == id).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<Product>> GetAllAsync()
    {
        return await _collection.Find(_ => true).ToListAsync();
    }

    public async Task<IEnumerable<Product>> GetByCategoryIdAsync(string categoryId)
    {
        return await _collection.Find(p => p.CategoryId == categoryId).ToListAsync();
    }

    public async Task<IEnumerable<Product>> GetByStatusAsync(string status)
    {
        return await _collection.Find(p => p.Status == status).ToListAsync();
    }

    public async Task<Product?> GetBySkuAsync(string sku)
    {
        return await _collection.Find(p => p.SKU == sku).FirstOrDefaultAsync();
    }

    public async Task<Product> CreateAsync(Product product)
    {
        await _collection.InsertOneAsync(product);
        return product;
    }

    public async Task<Product> UpdateAsync(Product product)
    {
        product.UpdatedAt = DateTime.UtcNow;
        await _collection.ReplaceOneAsync(p => p.Id == product.Id, product);
        return product;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _collection.DeleteOneAsync(p => p.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<bool> ExistsAsync(string id)
    {
        var count = await _collection.CountDocumentsAsync(p => p.Id == id);
        return count > 0;
    }

    public async Task<bool> SkuExistsAsync(string sku)
    {
        var count = await _collection.CountDocumentsAsync(p => p.SKU == sku);
        return count > 0;
    }
}

