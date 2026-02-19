using MongoDB.Driver;
using Ordina.Database.Entities.Role;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class RoleRepository : IRoleRepository
{
    private readonly IMongoCollection<Role> _collection;

    public RoleRepository(MongoDbContext context)
    {
        _collection = context.Roles;
    }

    public async Task<Role?> GetByIdAsync(string id)
    {
        return await _collection.Find(r => r.Id == id).FirstOrDefaultAsync();
    }

    public async Task<Role?> GetByNameAsync(string name)
    {
        return await _collection.Find(r => r.Name == name).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<Role>> GetAllAsync()
    {
        return await _collection.Find(_ => true).ToListAsync();
    }

    public async Task<Role> CreateAsync(Role role)
    {
        role.CreatedAt = DateTime.UtcNow;
        role.UpdatedAt = DateTime.UtcNow;
        await _collection.InsertOneAsync(role);
        return role;
    }

    public async Task<Role> UpdateAsync(Role role)
    {
        role.UpdatedAt = DateTime.UtcNow;
        await _collection.ReplaceOneAsync(r => r.Id == role.Id, role);
        return role;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _collection.DeleteOneAsync(r => r.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<bool> ExistsAsync(string id)
    {
        var count = await _collection.CountDocumentsAsync(r => r.Id == id);
        return count > 0;
    }
}
