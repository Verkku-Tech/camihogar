using Ordina.Database.Entities.Store;

namespace Ordina.Database.Repositories;

public interface IStoreRepository
{
    Task<Store?> GetByIdAsync(string id);
    Task<IEnumerable<Store>> GetAllAsync();
    Task<Store?> GetByCodeAsync(string code);
    Task<IEnumerable<Store>> GetByStatusAsync(string status);
    Task<Store> CreateAsync(Store store);
    Task<Store> UpdateAsync(Store store);
    Task<bool> DeleteAsync(string id);
    Task<bool> ExistsAsync(string id);
}

