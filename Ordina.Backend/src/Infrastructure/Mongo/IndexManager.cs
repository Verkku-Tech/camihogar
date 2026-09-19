using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using Ordina.Domain.Catalog;
using Ordina.Domain.Common;
using Ordina.Domain.Orders;
using Ordina.Domain.Security;
using Ordina.Domain.Users;

namespace Ordina.Infrastructure.Mongo;

public class IndexManager
{
    private readonly MongoDbContext _context;
    private readonly ILogger<IndexManager> _logger;

    public IndexManager(MongoDbContext context, ILogger<IndexManager> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Verificando e inicializando índices de MongoDB...");

            // 1. Users Indexes
            var userIndexOptions = new CreateIndexOptions { Unique = true };
            await _context.Users.Indexes.CreateManyAsync(new[]
            {
                new CreateIndexModel<User>(Builders<User>.IndexKeys.Ascending(u => u.Username), userIndexOptions),
                new CreateIndexModel<User>(Builders<User>.IndexKeys.Ascending(u => u.Email), userIndexOptions)
            }, cancellationToken);

            // 2. Clients Indexes
            await _context.Clients.Indexes.CreateOneAsync(
                new CreateIndexModel<Client>(
                    Builders<Client>.IndexKeys.Ascending(c => c.RutId),
                    new CreateIndexOptions { Unique = true }),
                cancellationToken: cancellationToken);

            // 3. Orders Indexes
            await _context.Orders.Indexes.CreateManyAsync(new[]
            {
                new CreateIndexModel<Order>(
                    Builders<Order>.IndexKeys.Ascending(o => o.OrderNumber),
                    new CreateIndexOptions { Unique = true }),
                new CreateIndexModel<Order>(Builders<Order>.IndexKeys.Ascending(o => o.StatusString)),
                new CreateIndexModel<Order>(Builders<Order>.IndexKeys.Ascending(o => o.ClientId)),
                new CreateIndexModel<Order>(Builders<Order>.IndexKeys.Ascending(o => o.TypeString)),
                new CreateIndexModel<Order>(Builders<Order>.IndexKeys.Ascending(o => o.CreatedAt))
            }, cancellationToken);

            // 4. Products Indexes
            await _context.Products.Indexes.CreateManyAsync(new[]
            {
                new CreateIndexModel<Product>(
                    Builders<Product>.IndexKeys.Ascending(p => p.SKU),
                    new CreateIndexOptions { Unique = true }),
                new CreateIndexModel<Product>(Builders<Product>.IndexKeys.Ascending(p => p.CategoryId))
            }, cancellationToken);

            // 5. RefreshTokens Indexes
            await _context.RefreshTokens.Indexes.CreateManyAsync(new[]
            {
                new CreateIndexModel<RefreshToken>(Builders<RefreshToken>.IndexKeys.Ascending(r => r.Token)),
                new CreateIndexModel<RefreshToken>(Builders<RefreshToken>.IndexKeys.Ascending(r => r.UserId)),
                new CreateIndexModel<RefreshToken>(
                    Builders<RefreshToken>.IndexKeys.Ascending(r => r.ExpiresAt),
                    new CreateIndexOptions { ExpireAfter = TimeSpan.Zero })
            }, cancellationToken);

            // 6. IdempotencyKeys Indexes (Unique on MutationId, TTL 24h on CreatedAt)
            await _context.IdempotencyRecords.Indexes.CreateManyAsync(new[]
            {
                new CreateIndexModel<IdempotencyRecord>(
                    Builders<IdempotencyRecord>.IndexKeys.Ascending(x => x.MutationId),
                    new CreateIndexOptions { Unique = true }),
                new CreateIndexModel<IdempotencyRecord>(
                    Builders<IdempotencyRecord>.IndexKeys.Ascending(x => x.CreatedAt),
                    new CreateIndexOptions { ExpireAfter = TimeSpan.FromHours(24) })
            }, cancellationToken);

            _logger.LogInformation("Índices de MongoDB inicializados exitosamente.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Advertencia al inicializar índices de MongoDB (pueden ya existir): {Message}", ex.Message);
        }
    }
}
