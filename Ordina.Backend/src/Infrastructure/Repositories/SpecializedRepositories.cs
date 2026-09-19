using MongoDB.Bson;
using MongoDB.Driver;
using Ordina.Application.Common;
using Ordina.Domain.Catalog;
using Ordina.Domain.Common;
using Ordina.Domain.Finance;
using Ordina.Domain.Orders;
using Ordina.Domain.Security;
using Ordina.Domain.Users;
using Ordina.Infrastructure.Mongo;

namespace Ordina.Infrastructure.Repositories;

public class OrderRepository : MongoRepository<Order>, IOrderRepository
{
    public OrderRepository(MongoDbContext context) : base(context.Database, "orders")
    {
    }

    public async Task<Order?> GetByOrderNumberAsync(string orderNumber, CancellationToken cancellationToken = default)
    {
        var filter = Builders<Order>.Filter.Eq(o => o.OrderNumber, orderNumber);
        return await _collection.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<string> GenerateOrderNumberAsync(string prefix, CancellationToken cancellationToken = default)
    {
        // Generar un número de secuencia incremental basado en el conteo + 1
        var filter = Builders<Order>.Filter.Regex(o => o.OrderNumber, new BsonRegularExpression($"^{prefix}-"));
        var count = await _collection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
        var nextNumber = count + 1;
        return $"{prefix}-{nextNumber:D5}";
    }
}

public class UserRepository : MongoRepository<User>, IUserRepository
{
    public UserRepository(MongoDbContext context) : base(context.Database, "users")
    {
    }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        var filter = Builders<User>.Filter.Eq(u => u.Email, email.ToLowerInvariant());
        return await _collection.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<User?> GetByUsernameAsync(string username, CancellationToken cancellationToken = default)
    {
        var filter = Builders<User>.Filter.Eq(u => u.Username, username);
        return await _collection.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }
}

public class ClientRepository : MongoRepository<Client>, IClientRepository
{
    public ClientRepository(MongoDbContext context) : base(context.Database, "clients")
    {
    }

    public async Task<Client?> GetByRutAsync(string rutId, CancellationToken cancellationToken = default)
    {
        var filter = Builders<Client>.Filter.Eq(c => c.RutId, rutId);
        return await _collection.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }
}

public class ProductRepository : MongoRepository<Product>, IProductRepository
{
    public ProductRepository(MongoDbContext context) : base(context.Database, "products")
    {
    }

    public async Task<Product?> GetBySkuAsync(string sku, CancellationToken cancellationToken = default)
    {
        var filter = Builders<Product>.Filter.Eq(p => p.SKU, sku);
        return await _collection.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Product>> GetByCategoryIdAsync(string categoryId, CancellationToken cancellationToken = default)
    {
        var filter = Builders<Product>.Filter.Eq(p => p.CategoryId, categoryId);
        return await _collection.Find(filter).ToListAsync(cancellationToken);
    }
}

public class ExchangeRateRepository : MongoRepository<ExchangeRate>, IExchangeRateRepository
{
    public ExchangeRateRepository(MongoDbContext context) : base(context.Database, "exchangeRates")
    {
    }

    public async Task<ExchangeRate?> GetLatestRateAsync(string fromCurrency, string toCurrency, CancellationToken cancellationToken = default)
    {
        var filter = Builders<ExchangeRate>.Filter.And(
            Builders<ExchangeRate>.Filter.Eq(r => r.FromCurrency, fromCurrency),
            Builders<ExchangeRate>.Filter.Eq(r => r.ToCurrency, toCurrency),
            Builders<ExchangeRate>.Filter.Eq(r => r.IsActive, true));

        return await _collection.Find(filter)
            .SortByDescending(r => r.EffectiveDate)
            .FirstOrDefaultAsync(cancellationToken);
    }
}

public class RefreshTokenRepository : MongoRepository<RefreshToken>, IRefreshTokenRepository
{
    public RefreshTokenRepository(MongoDbContext context) : base(context.Database, "refreshTokens")
    {
    }

    public async Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        var filter = Builders<RefreshToken>.Filter.Eq(r => r.Token, token);
        return await _collection.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task RevokeByUserIdAsync(string userId, CancellationToken cancellationToken = default)
    {
        var filter = Builders<RefreshToken>.Filter.Eq(r => r.UserId, userId);
        var update = Builders<RefreshToken>.Update.Set(r => r.IsRevoked, true).Set(r => r.UpdatedAt, DateTime.UtcNow);
        await _collection.UpdateManyAsync(filter, update, cancellationToken: cancellationToken);
    }
}

public class IdempotencyRepository : IIdempotencyRepository
{
    private readonly IMongoCollection<IdempotencyRecord> _collection;

    public IdempotencyRepository(MongoDbContext context)
    {
        _collection = context.IdempotencyRecords;
    }

    public async Task<IdempotencyRecord?> GetByMutationIdAsync(string mutationId, CancellationToken cancellationToken = default)
    {
        var filter = Builders<IdempotencyRecord>.Filter.Eq(x => x.MutationId, mutationId);
        return await _collection.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task SaveAsync(IdempotencyRecord record, CancellationToken cancellationToken = default)
    {
        await _collection.InsertOneAsync(record, cancellationToken: cancellationToken);
    }
}
