using Ordina.Database.Entities.Vendor;

namespace Ordina.Database.Repositories;

public interface IVendorRepository
{
    Task<Vendor?> GetByIdAsync(string id);
    Task<IEnumerable<Vendor>> GetAllAsync();
    Task<IEnumerable<Vendor>> GetByTypeAsync(string type);
    Task<Vendor> CreateAsync(Vendor vendor);
    Task<Vendor> UpdateAsync(Vendor vendor);
    Task<bool> DeleteAsync(string id);
    Task<bool> ExistsAsync(string id);
}

