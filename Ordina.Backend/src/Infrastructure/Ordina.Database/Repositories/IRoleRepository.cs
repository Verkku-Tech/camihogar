using Ordina.Database.Entities.Role;

namespace Ordina.Database.Repositories;

public interface IRoleRepository
{
    Task<Role?> GetByIdAsync(string id);
    Task<Role?> GetByNameAsync(string name);
    Task<IEnumerable<Role>> GetAllAsync();
    Task<Role> CreateAsync(Role role);
    Task<Role> UpdateAsync(Role role);
    Task<bool> DeleteAsync(string id);
    Task<bool> ExistsAsync(string id);
}
