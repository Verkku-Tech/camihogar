using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using Ordina.Database.Repositories;

namespace Ordina.Database.MongoContext;

public static class MongoDbServiceExtensions
{
    /// <summary>
    /// Configura MongoDB y registra todos los servicios necesarios
    /// </summary>
    public static IServiceCollection AddMongoDb(this IServiceCollection services, IConfiguration configuration)
    {
        // Configurar MongoDbSettings
        var mongoSettings = configuration.GetSection("MongoDb").Get<MongoDbSettings>()
            ?? throw new InvalidOperationException("MongoDb configuration section is missing. Please add 'MongoDb' section to appsettings.json");

        services.AddSingleton(mongoSettings);

        // Registrar MongoClient como Singleton (recomendado por MongoDB)
        services.AddSingleton<IMongoClient>(sp =>
            new MongoClient(mongoSettings.ConnectionString));

        // Registrar MongoDbContext como Scoped
        services.AddScoped<MongoDbContext>(sp =>
        {
            var client = sp.GetRequiredService<IMongoClient>();
            return new MongoDbContext(client, mongoSettings.DatabaseName);
        });

        // Registrar todos los repositorios
        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IClientRepository, ClientRepository>();
        services.AddScoped<IProviderRepository, ProviderRepository>();
        services.AddScoped<IStoreRepository, StoreRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IVendorRepository, VendorRepository>();
        services.AddScoped<IPaymentRepository, PaymentRepository>();
        services.AddScoped<IPaymentMethodRepository, PaymentMethodRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();

        return services;
    }
}

