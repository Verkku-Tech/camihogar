using MongoDB.Driver;
using Ordina.Database.Entities.Account;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class AccountRepository : IAccountRepository
{
    private readonly IMongoCollection<Account> _collection;

    public AccountRepository(MongoDbContext context)
    {
        _collection = context.Accounts;
    }

    public async Task<Account?> GetByIdAsync(string id)
    {
        return await _collection.Find(a => a.Id == id).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<Account>> GetAllAsync()
    {
        return await _collection.Find(_ => true).ToListAsync();
    }

    public async Task<IEnumerable<Account>> GetByStoreIdAsync(string storeId)
    {
        return await _collection.Find(a => a.StoreId == storeId).ToListAsync();
    }

    public async Task<IEnumerable<Account>> GetByActiveStatusAsync(bool isActive)
    {
        return await _collection.Find(a => a.IsActive == isActive).ToListAsync();
    }

    public async Task<Account?> GetByCodeAsync(string code)
    {
        return await _collection.Find(a => a.Code == code).FirstOrDefaultAsync();
    }

    public async Task<Account> CreateAsync(Account account)
    {
        account.CreatedAt = DateTime.UtcNow;
        account.UpdatedAt = DateTime.UtcNow;
        await _collection.InsertOneAsync(account);
        return account;
    }

    public async Task<Account> UpdateAsync(Account account)
    {
        account.UpdatedAt = DateTime.UtcNow;
        await _collection.ReplaceOneAsync(a => a.Id == account.Id, account);
        return account;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _collection.DeleteOneAsync(a => a.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<bool> ExistsAsync(string id)
    {
        return await _collection.Find(a => a.Id == id).AnyAsync();
    }
}