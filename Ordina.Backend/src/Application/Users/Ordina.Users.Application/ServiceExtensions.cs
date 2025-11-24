using Microsoft.Extensions.DependencyInjection;
using Ordina.Users.Application.Services;

namespace Ordina.Users.Application;

public static class ServiceExtensions
{
    public static IServiceCollection AddUserServices(this IServiceCollection services)
    {
        services.AddScoped<IUserService, UserService>();
        return services;
    }
}

