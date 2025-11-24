using MongoDB.Driver;
using Ordina.Database.Entities.Payment;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class PaymentMethodRepository : IPaymentMethodRepository
{
    private readonly IMongoCollection<PaymentMethod> _collection;

    public PaymentMethodRepository(MongoDbContext context)
    {
        _collection = context.PaymentMethods;
    }

    public async Task<PaymentMethod?> GetByIdAsync(string id)
    {
        return await _collection.Find(pm => pm.Id == id).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<PaymentMethod>> GetAllAsync()
    {
        return await _collection.Find(_ => true).ToListAsync();
    }

    public async Task<IEnumerable<PaymentMethod>> GetActiveAsync()
    {
        return await _collection.Find(pm => pm.IsActive).ToListAsync();
    }

    public async Task<PaymentMethod?> GetByNameAsync(string name)
    {
        return await _collection.Find(pm => pm.Name == name).FirstOrDefaultAsync();
    }

    public async Task<PaymentMethod> CreateAsync(PaymentMethod paymentMethod)
    {
        paymentMethod.CreatedAt = DateTime.UtcNow;
        await _collection.InsertOneAsync(paymentMethod);
        return paymentMethod;
    }

    public async Task<PaymentMethod> UpdateAsync(PaymentMethod paymentMethod)
    {
        paymentMethod.UpdatedAt = DateTime.UtcNow;
        await _collection.ReplaceOneAsync(pm => pm.Id == paymentMethod.Id, paymentMethod);
        return paymentMethod;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _collection.DeleteOneAsync(pm => pm.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<bool> ExistsAsync(string id)
    {
        var count = await _collection.CountDocumentsAsync(pm => pm.Id == id);
        return count > 0;
    }
}

