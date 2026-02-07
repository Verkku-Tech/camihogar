using MongoDB.Bson;
using Ordina.Database.Entities.Provider;

namespace Ordina.Database.Repositories;

public interface IProviderRepository
{
    Task<Provider?> GetByIdAsync(ObjectId id);
    Task<IEnumerable<Provider>> GetAllAsync();
    Task<Provider?> GetByRifAsync(string rif);
    Task<Provider?> GetByEmailAsync(string email);
    Task<IEnumerable<Provider>> GetByEstadoAsync(string estado);
    Task<Provider> CreateAsync(Provider provider);
    Task<Provider> UpdateAsync(Provider provider);
    Task<bool> DeleteAsync(ObjectId id);
    Task<bool> ExistsAsync(ObjectId id);
}

