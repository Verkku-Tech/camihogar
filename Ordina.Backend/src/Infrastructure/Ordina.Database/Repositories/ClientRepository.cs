using MongoDB.Bson;
using MongoDB.Driver;
using Ordina.Database.Entities.Client;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class ClientRepository : IClientRepository
{
    private readonly IMongoCollection<Client> _collection;

    public ClientRepository(MongoDbContext context)
    {
        _collection = context.Clients;
    }

    public async Task<Client?> GetByIdAsync(string id)
    {
        return await _collection.Find(c => c.Id == id).FirstOrDefaultAsync();
    }

    public async Task<(IEnumerable<Client> Items, long TotalCount)> GetAllAsync(int page, int pageSize, string? search)
    {
        var filter = Builders<Client>.Filter.Empty;

        if (!string.IsNullOrWhiteSpace(search))
        {
            var regex = new BsonRegularExpression(search, "i");
            filter = Builders<Client>.Filter.Or(
                Builders<Client>.Filter.Regex(x => x.NombreRazonSocial, regex),
                Builders<Client>.Filter.Regex(x => x.RutId, regex),
                Builders<Client>.Filter.Regex(x => x.Apodo, regex)
            );
        }

        var totalCount = await _collection.CountDocumentsAsync(filter);
        
        var items = await _collection.Find(filter)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<IEnumerable<Client>> GetAllAsync()
    {
        return await _collection.Find(Builders<Client>.Filter.Empty).ToListAsync();
    }

    public async Task<Client?> GetByRutIdAsync(string rutId)
    {
        return await _collection.Find(c => c.RutId == rutId).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<Client>> GetByEstadoAsync(string estado)
    {
        return await _collection.Find(c => c.Estado == estado).ToListAsync();
    }

    public async Task<Client> CreateAsync(Client client)
    {
        client.FechaCreacion = DateTime.UtcNow;
        await _collection.InsertOneAsync(client);
        return client;
    }

    public async Task<Client> UpdateAsync(Client client)
    {
        await _collection.ReplaceOneAsync(c => c.Id == client.Id, client);
        return client;
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

    public async Task<bool> RutIdExistsAsync(string rutId)
    {
        var count = await _collection.CountDocumentsAsync(c => c.RutId == rutId);
        return count > 0;
    }
}

