using MongoDB.Driver;
using Ordina.Database.Entities.Commission;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class CommissionRepository : ICommissionRepository
{
    private readonly IMongoCollection<Commission> _collection;

    public CommissionRepository(MongoDbContext context)
    {
        _collection = context.Commissions;
    }

    public async Task<Commission?> GetByIdAsync(string id)
    {
        return await _collection.Find(c => c.Id == id).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<Commission>> GetAllAsync()
    {
        return await _collection.Find(_ => true).ToListAsync();
    }

    public async Task<IEnumerable<Commission>> GetByUserIdAsync(string userId)
    {
        return await _collection.Find(c => c.UserId == userId).ToListAsync();
    }

    public async Task<IEnumerable<Commission>> GetByRoleAsync(string role)
    {
        return await _collection.Find(c => c.Role == role).ToListAsync();
    }

    public async Task<Commission> CreateAsync(Commission commission)
    {
        commission.CreatedAt = DateTime.UtcNow;
        commission.UpdatedAt = DateTime.UtcNow;
        await _collection.InsertOneAsync(commission);
        return commission;
    }

    public async Task<Commission> UpdateAsync(Commission commission)
    {
        commission.UpdatedAt = DateTime.UtcNow;
        await _collection.ReplaceOneAsync(c => c.Id == commission.Id, commission);
        return commission;
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

