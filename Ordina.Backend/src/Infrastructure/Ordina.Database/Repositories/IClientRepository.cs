using Ordina.Database.Entities.Client;

namespace Ordina.Database.Repositories;

public interface IClientRepository
{
    Task<Client?> GetByIdAsync(string id);
    Task<(IEnumerable<Client> Items, long TotalCount)> GetAllAsync(int page, int pageSize, string? search);
    Task<IEnumerable<Client>> GetAllAsync();
    Task<Client?> GetByRutIdAsync(string rutId);
    Task<IEnumerable<Client>> GetByEstadoAsync(string estado);
    Task<Client> CreateAsync(Client client);
    Task<Client> UpdateAsync(Client client);
    Task<bool> DeleteAsync(string id);
    Task<bool> ExistsAsync(string id);
    Task<bool> RutIdExistsAsync(string rutId);
}

