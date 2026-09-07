using Microsoft.Extensions.DependencyInjection;
using Ordina.Users.Application.Services;
using Ordina.Database.Repositories;

namespace Ordina.Users.Application;

public static class ServiceExtensions
{
    public static IServiceCollection AddUserServices(this IServiceCollection services)
    {
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IRoleService, RoleService>();
        services.AddScoped<IClientService, ClientService>();
        // IOrderRepository se registra en el módulo Infrastructure pero se necesita aquí para ClientService
        return services;
    }
}

