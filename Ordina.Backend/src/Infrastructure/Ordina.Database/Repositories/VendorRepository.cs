using MongoDB.Driver;
using Ordina.Database.Entities.Vendor;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class VendorRepository : IVendorRepository
{
    private readonly IMongoCollection<Vendor> _collection;

    public VendorRepository(MongoDbContext context)
    {
        _collection = context.Vendors;
    }

    public async Task<Vendor?> GetByIdAsync(string id)
    {
        return await _collection.Find(v => v.Id == id).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<Vendor>> GetAllAsync()
    {
        return await _collection.Find(_ => true).ToListAsync();
    }

    public async Task<IEnumerable<Vendor>> GetByTypeAsync(string type)
    {
        return await _collection.Find(v => v.Type == type).ToListAsync();
    }

    public async Task<Vendor> CreateAsync(Vendor vendor)
    {
        await _collection.InsertOneAsync(vendor);
        return vendor;
    }

    public async Task<Vendor> UpdateAsync(Vendor vendor)
    {
        await _collection.ReplaceOneAsync(v => v.Id == vendor.Id, vendor);
        return vendor;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _collection.DeleteOneAsync(v => v.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<bool> ExistsAsync(string id)
    {
        var count = await _collection.CountDocumentsAsync(v => v.Id == id);
        return count > 0;
    }
}

