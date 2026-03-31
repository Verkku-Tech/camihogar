using MongoDB.Bson;
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

    public async Task<long> DeleteManyAsync(IEnumerable<string> ids)
    {
        var idList = ids.Where(id => !string.IsNullOrWhiteSpace(id)).Distinct().ToList();
        if (idList.Count == 0)
            return 0;

        var filter = Builders<Product>.Filter.In(p => p.Id, idList);
        var result = await _collection.DeleteManyAsync(filter);
        return result.DeletedCount;
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

    public async Task<Product?> GetByNameAndCategoryIdAsync(string name, string categoryId)
    {
        return await _collection
            .Find(p => p.Name == name && p.CategoryId == categoryId)
            .FirstOrDefaultAsync();
    }

    public async Task<(IEnumerable<Product> Items, long TotalCount)> GetPaginatedAsync(
        int page, int pageSize, string? search = null,
        string? categoryId = null, string? status = null)
    {
        var filter = Builders<Product>.Filter.Empty;

        if (!string.IsNullOrWhiteSpace(search))
        {
            filter &= BuildSearchFilter(search);
        }

        if (!string.IsNullOrWhiteSpace(categoryId))
            filter &= Builders<Product>.Filter.Eq(p => p.CategoryId, categoryId);

        if (!string.IsNullOrWhiteSpace(status))
            filter &= Builders<Product>.Filter.Eq(p => p.Status, status);

        var totalCount = await _collection.CountDocumentsAsync(filter);
        var skip = (page - 1) * pageSize;

        var items = await _collection
            .Find(filter)
            .SortByDescending(p => p.CreatedAt)
            .Skip(skip)
            .Limit(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<IEnumerable<Product>> SearchAsync(string search, int limit = 20)
    {
        var filter = BuildSearchFilter(search);

        return await _collection
            .Find(filter)
            .Limit(limit)
            .ToListAsync();
    }

    public async Task<long> CountByCategoryIdAsync(string categoryId)
    {
        return await _collection.CountDocumentsAsync(p => p.CategoryId == categoryId);
    }

    private FilterDefinition<Product> BuildSearchFilter(string? search)
    {
        var filter = Builders<Product>.Filter.Empty;
        if (string.IsNullOrWhiteSpace(search)) return filter;

        var terms = search.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var andFilters = new List<FilterDefinition<Product>>();

        foreach (var term in terms)
        {
            var escapedTerm = System.Text.RegularExpressions.Regex.Escape(term);
            var regex = new BsonRegularExpression(escapedTerm, "i");
            var termOrFilter = Builders<Product>.Filter.Or(
                Builders<Product>.Filter.Regex(p => p.Name, regex),
                Builders<Product>.Filter.Regex(p => p.SKU, regex),
                Builders<Product>.Filter.Regex(p => p.Category, regex));
            andFilters.Add(termOrFilter);
        }

        return Builders<Product>.Filter.And(andFilters);
    }
}

