using MongoDB.Bson;
using MongoDB.Driver;
using Ordina.Database.Entities.Provider;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class ProviderRepository : IProviderRepository
{
    private readonly IMongoCollection<Provider> _collection;

    public ProviderRepository(MongoDbContext context)
    {
        _collection = context.Providers;
    }

    public async Task<Provider?> GetByIdAsync(ObjectId id)
    {
        return await _collection.Find(p => p.Id == id).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<Provider>> GetAllAsync()
    {
        return await _collection.Find(_ => true).ToListAsync();
    }

    public async Task<Provider?> GetByRifAsync(string rif)
    {
        return await _collection.Find(p => p.Rif == rif).FirstOrDefaultAsync();
    }

    public async Task<Provider?> GetByEmailAsync(string email)
    {
        return await _collection.Find(p => p.Email == email).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<Provider>> GetByEstadoAsync(string estado)
    {
        return await _collection.Find(p => p.Estado == estado).ToListAsync();
    }

    public async Task<Provider> CreateAsync(Provider provider)
    {
        provider.FechaCreacion = DateTime.UtcNow;
        await _collection.InsertOneAsync(provider);
        return provider;
    }

    public async Task<Provider> UpdateAsync(Provider provider)
    {
        await _collection.ReplaceOneAsync(p => p.Id == provider.Id, provider);
        return provider;
    }

    public async Task<bool> DeleteAsync(ObjectId id)
    {
        var result = await _collection.DeleteOneAsync(p => p.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<bool> ExistsAsync(ObjectId id)
    {
        var count = await _collection.CountDocumentsAsync(p => p.Id == id);
        return count > 0;
    }
}

