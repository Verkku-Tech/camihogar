using Microsoft.Extensions.DependencyInjection;
using Ordina.Providers.Application.Services;

namespace Ordina.Providers.Application;

public static class ServiceExtensions
{
    public static IServiceCollection AddProviderServices(this IServiceCollection services)
    {
        services.AddScoped<ICategoryService, CategoryService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<IProviderService, ProviderService>();
        services.AddScoped<IImportService, ImportService>();
        return services;
    }
}
