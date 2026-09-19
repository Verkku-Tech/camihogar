using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using Ordina.Application.Common;
using Ordina.Application.Security;
using Ordina.Domain.Catalog;
using Ordina.Domain.Dispatch;
using Ordina.Domain.Finance;
using Ordina.Domain.Manufacturing;
using Ordina.Domain.Orders;
using Ordina.Domain.Security;
using Ordina.Domain.Stores;
using Ordina.Domain.Users;
using Ordina.Infrastructure.Caching;
using Ordina.Infrastructure.Mongo;
using Ordina.Infrastructure.Repositories;
using Ordina.Infrastructure.Security;

namespace Ordina.Infrastructure;

public static class InfrastructureServiceExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // 1. Singleton MongoClient (Cero EF Core, cero Postgres, cero Redis)
        var connectionString = configuration.GetConnectionString("MongoDB")
                               ?? configuration["MongoDb:ConnectionString"]
                               ?? configuration["MongoDB"]
                               ?? "mongodb://localhost:27017";

        services.AddSingleton<IMongoClient>(_ => new MongoClient(connectionString));
        services.AddSingleton<MongoDbContext>();

        // 2. Generic and Specialized Repositories
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IClientRepository, ClientRepository>();
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<IExchangeRateRepository, ExchangeRateRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IIdempotencyRepository, IdempotencyRepository>();

        services.AddScoped<IRepository<Category>>(sp => new MongoRepository<Category>(sp.GetRequiredService<MongoDbContext>().Database, "categories"));
        services.AddScoped<IRepository<Provider>>(sp => new MongoRepository<Provider>(sp.GetRequiredService<MongoDbContext>().Database, "providers"));
        services.AddScoped<IRepository<Role>>(sp => new MongoRepository<Role>(sp.GetRequiredService<MongoDbContext>().Database, "roles"));
        services.AddScoped<IRepository<Payment>>(sp => new MongoRepository<Payment>(sp.GetRequiredService<MongoDbContext>().Database, "payments"));
        services.AddScoped<IRepository<PaymentMethod>>(sp => new MongoRepository<PaymentMethod>(sp.GetRequiredService<MongoDbContext>().Database, "payment_methods"));
        services.AddScoped<IRepository<Commission>>(sp => new MongoRepository<Commission>(sp.GetRequiredService<MongoDbContext>().Database, "commissions"));
        services.AddScoped<IRepository<ProductCommission>>(sp => new MongoRepository<ProductCommission>(sp.GetRequiredService<MongoDbContext>().Database, "product_commissions"));
        services.AddScoped<IRepository<SaleTypeCommissionRule>>(sp => new MongoRepository<SaleTypeCommissionRule>(sp.GetRequiredService<MongoDbContext>().Database, "sale_type_commission_rules"));
        services.AddScoped<IRepository<Store>>(sp => new MongoRepository<Store>(sp.GetRequiredService<MongoDbContext>().Database, "stores"));
        services.AddScoped<IRepository<Account>>(sp => new MongoRepository<Account>(sp.GetRequiredService<MongoDbContext>().Database, "accounts"));
        services.AddScoped<IRepository<DispatchRoute>>(sp => new MongoRepository<DispatchRoute>(sp.GetRequiredService<MongoDbContext>().Database, "dispatch_routes"));
        services.AddScoped<IRepository<WorkOrder>>(sp => new MongoRepository<WorkOrder>(sp.GetRequiredService<MongoDbContext>().Database, "work_orders"));

        // 3. Security & Caching
        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddSingleton<ITokenService, JwtTokenGenerator>();
        services.AddSingleton<ICacheService, MemoryCacheService>();

        // 4. Index Manager and Database Seeder
        services.AddSingleton<IndexManager>();
        services.AddScoped<MongoDatabaseSeeder>();

        return services;
    }
}
