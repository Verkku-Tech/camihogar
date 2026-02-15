using Microsoft.Extensions.DependencyInjection;
using Ordina.Database.Repositories;
using Ordina.Stores.Application.Services;

namespace Ordina.Stores.Application;

public static class ServiceExtensions
{
    public static IServiceCollection AddStoreServices(this IServiceCollection services)
    {
        services.AddScoped<IAccountService, AccountService>();
        services.AddScoped<IAccountRepository, AccountRepository>();
        services.AddScoped<IStoreService, StoreService>();
        services.AddScoped<IStoreRepository, StoreRepository>();
        return services;
    }
}