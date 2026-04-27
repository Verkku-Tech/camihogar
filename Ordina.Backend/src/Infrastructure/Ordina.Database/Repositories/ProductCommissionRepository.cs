using System.Text.RegularExpressions;
using MongoDB.Bson;
using MongoDB.Driver;
using Ordina.Database.Entities.Commission;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class ProductCommissionRepository : IProductCommissionRepository
{
    private readonly IMongoCollection<ProductCommission> _collection;

    public ProductCommissionRepository(MongoDbContext context)
    {
        _collection = context.ProductCommissions;
    }

    public async Task<ProductCommission?> GetByIdAsync(string id)
    {
        return await _collection.Find(c => c.Id == id).FirstOrDefaultAsync();
    }

    public async Task<ProductCommission?> GetByCategoryIdAsync(string categoryId)
    {
        return await _collection.Find(c => c.CategoryId == categoryId).FirstOrDefaultAsync();
    }

    public async Task<ProductCommission?> GetByCategoryNameAsync(string categoryName)
    {
        if (string.IsNullOrWhiteSpace(categoryName)) return null;
        var trimmed = categoryName.Trim();
        // Coincidencia exacta insensible a mayúsculas (evita duplicados "Copete solo" vs "Copete Solo")
        var pattern = "^" + Regex.Escape(trimmed) + "$";
        var filter = Builders<ProductCommission>.Filter.Regex(
            c => c.CategoryName,
            new BsonRegularExpression(pattern, "i"));
        return await _collection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<ProductCommission>> GetAllAsync()
    {
        return await _collection.Find(_ => true).ToListAsync();
    }

    public async Task<ProductCommission> CreateAsync(ProductCommission commission)
    {
        commission.CreatedAt = DateTime.UtcNow;
        commission.UpdatedAt = DateTime.UtcNow;
        await _collection.InsertOneAsync(commission);
        return commission;
    }

    public async Task<ProductCommission> UpdateAsync(ProductCommission commission)
    {
        commission.UpdatedAt = DateTime.UtcNow;
        await _collection.ReplaceOneAsync(c => c.Id == commission.Id, commission);
        return commission;
    }

    public async Task<ProductCommission> UpsertByCategoryAsync(ProductCommission commission)
    {
        ProductCommission? existing = null;
        if (!string.IsNullOrWhiteSpace(commission.CategoryId))
            existing = await GetByCategoryIdAsync(commission.CategoryId);
        if (existing == null && !string.IsNullOrWhiteSpace(commission.CategoryName))
            existing = await GetByCategoryNameAsync(commission.CategoryName);

        if (existing != null)
        {
            commission.Id = existing.Id;
            commission.CreatedAt = existing.CreatedAt;
            if (string.IsNullOrWhiteSpace(commission.CategoryId))
                commission.CategoryId = existing.CategoryId;
            var incomingName = (commission.CategoryName ?? string.Empty).Trim();
            commission.CategoryName = !string.IsNullOrEmpty(incomingName)
                ? incomingName
                : (existing.CategoryName ?? string.Empty).Trim();
            return await UpdateAsync(commission);
        }

        if (!string.IsNullOrWhiteSpace(commission.CategoryName))
            commission.CategoryName = commission.CategoryName.Trim();

        if (string.IsNullOrWhiteSpace(commission.CategoryId) && !string.IsNullOrWhiteSpace(commission.CategoryName))
            commission.CategoryId = commission.CategoryName;

        return await CreateAsync(commission);
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _collection.DeleteOneAsync(c => c.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<bool> DeleteByCategoryIdAsync(string categoryId)
    {
        var result = await _collection.DeleteOneAsync(c => c.CategoryId == categoryId);
        return result.DeletedCount > 0;
    }

    public async Task<bool> ExistsAsync(string id)
    {
        var count = await _collection.CountDocumentsAsync(c => c.Id == id);
        return count > 0;
    }
}
