using Ordina.Database.Entities.Account;

namespace Ordina.Database.Repositories;

public interface IAccountRepository
{
    Task<Account?> GetByIdAsync(string id);
    Task<IEnumerable<Account>> GetAllAsync();
    Task<IEnumerable<Account>> GetByStoreIdAsync(string storeId);
    Task<IEnumerable<Account>> GetByActiveStatusAsync(bool isActive);
    Task<Account?> GetByCodeAsync(string code);
    Task<Account> CreateAsync(Account account);
    Task<Account> UpdateAsync(Account account);
    Task<bool> DeleteAsync(string id);
    Task<bool> ExistsAsync(string id);
}