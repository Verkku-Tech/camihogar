using Ordina.Database.Entities.Commission;

namespace Ordina.Database.Repositories;

public interface ICommissionRepository
{
    Task<Commission?> GetByIdAsync(string id);
    Task<IEnumerable<Commission>> GetAllAsync();
    Task<IEnumerable<Commission>> GetByUserIdAsync(string userId);
    Task<IEnumerable<Commission>> GetByRoleAsync(string role);
    Task<Commission> CreateAsync(Commission commission);
    Task<Commission> UpdateAsync(Commission commission);
    Task<bool> DeleteAsync(string id);
    Task<bool> ExistsAsync(string id);
}

