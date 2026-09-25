using MongoDB.Driver;
using Ordina.Application.Inventory;
using Ordina.Domain.Inventory;
using Ordina.Infrastructure.Mongo;

namespace Ordina.Infrastructure.Repositories;

public class PhysicalStockRepository(MongoDbContext context) 
    : MongoRepository<PhysicalStock>(context.Database, "physical_stocks"), IPhysicalStockRepository
{
    public async Task<bool> ReserveStockAtomicAsync(string stockId, int quantity, CancellationToken ct = default)
    {
        var filter = Builders<PhysicalStock>.Filter.Where(s => s.Id == stockId && (s.Quantity - s.ReservedQuantity) >= quantity);
        var update = Builders<PhysicalStock>.Update.Inc(s => s.ReservedQuantity, quantity).Set(s => s.UpdatedAt, DateTime.UtcNow);
        var res = await _collection.UpdateOneAsync(filter, update, cancellationToken: ct);
        return res.ModifiedCount > 0;
    }

    public async Task<bool> ReleaseStockAtomicAsync(string stockId, int quantity, CancellationToken ct = default)
    {
        var filter = Builders<PhysicalStock>.Filter.Eq(s => s.Id, stockId);
        var update = Builders<PhysicalStock>.Update.Inc(s => s.ReservedQuantity, -quantity).Set(s => s.UpdatedAt, DateTime.UtcNow);
        var res = await _collection.UpdateOneAsync(filter, update, cancellationToken: ct);
        return res.ModifiedCount > 0;
    }

    public async Task<bool> DeductSoldStockAtomicAsync(string stockId, int quantity, CancellationToken ct = default)
    {
        var filter = Builders<PhysicalStock>.Filter.Eq(s => s.Id, stockId);
        var update = Builders<PhysicalStock>.Update.Inc(s => s.Quantity, -quantity).Inc(s => s.ReservedQuantity, -quantity).Set(s => s.UpdatedAt, DateTime.UtcNow);
        var res = await _collection.UpdateOneAsync(filter, update, cancellationToken: ct);
        return res.ModifiedCount > 0;
    }
}
