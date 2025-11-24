using MongoDB.Driver;
using Ordina.Database.Entities.Payment;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class PaymentRepository : IPaymentRepository
{
    private readonly IMongoCollection<Payment> _collection;

    public PaymentRepository(MongoDbContext context)
    {
        _collection = context.Payments;
    }

    public async Task<Payment?> GetByIdAsync(string id)
    {
        return await _collection.Find(p => p.Id == id).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<Payment>> GetAllAsync()
    {
        return await _collection.Find(_ => true)
            .SortByDescending(p => p.CreatedAt)
            .ToListAsync();
    }

    public async Task<IEnumerable<Payment>> GetByOrderIdAsync(string orderId)
    {
        return await _collection.Find(p => p.OrderId == orderId)
            .SortByDescending(p => p.CreatedAt)
            .ToListAsync();
    }

    public async Task<IEnumerable<Payment>> GetByStatusAsync(string status)
    {
        return await _collection.Find(p => p.Status == status)
            .SortByDescending(p => p.CreatedAt)
            .ToListAsync();
    }

    public async Task<Payment> CreateAsync(Payment payment)
    {
        payment.CreatedAt = DateTime.UtcNow;
        await _collection.InsertOneAsync(payment);
        return payment;
    }

    public async Task<Payment> UpdateAsync(Payment payment)
    {
        payment.UpdatedAt = DateTime.UtcNow;
        await _collection.ReplaceOneAsync(p => p.Id == payment.Id, payment);
        return payment;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _collection.DeleteOneAsync(p => p.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<bool> ExistsAsync(string id)
    {
        var count = await _collection.CountDocumentsAsync(p => p.Id == id);
        return count > 0;
    }
}

