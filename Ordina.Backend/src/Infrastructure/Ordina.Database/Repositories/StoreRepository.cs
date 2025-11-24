using MongoDB.Driver;
using Ordina.Database.Entities.Store;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class StoreRepository : IStoreRepository
{
    private readonly IMongoCollection<Store> _collection;

    public StoreRepository(MongoDbContext context)
    {
        _collection = context.Stores;
    }

    public async Task<Store?> GetByIdAsync(string id)
    {
        return await _collection.Find(s => s.Id == id).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<Store>> GetAllAsync()
    {
        return await _collection.Find(_ => true).ToListAsync();
    }

    public async Task<Store?> GetByCodeAsync(string code)
    {
        return await _collection.Find(s => s.Code == code).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<Store>> GetByStatusAsync(string status)
    {
        return await _collection.Find(s => s.Status == status).ToListAsync();
    }

    public async Task<Store> CreateAsync(Store store)
    {
        store.CreatedAt = DateTime.UtcNow;
        store.UpdatedAt = DateTime.UtcNow;
        await _collection.InsertOneAsync(store);
        return store;
    }

    public async Task<Store> UpdateAsync(Store store)
    {
        store.UpdatedAt = DateTime.UtcNow;
        await _collection.ReplaceOneAsync(s => s.Id == store.Id, store);
        return store;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _collection.DeleteOneAsync(s => s.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<bool> ExistsAsync(string id)
    {
        var count = await _collection.CountDocumentsAsync(s => s.Id == id);
        return count > 0;
    }
}

