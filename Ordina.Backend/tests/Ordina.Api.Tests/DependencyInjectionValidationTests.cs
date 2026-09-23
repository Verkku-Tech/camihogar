using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using Ordina.Api.Controllers;
using Ordina.Application;
using Ordina.Application.Catalog;
using Ordina.Application.Clients;
using Ordina.Application.Common;
using Ordina.Application.Dashboard;
using Ordina.Application.Dispatch;
using Ordina.Application.Finance;
using Ordina.Application.Manufacturing;
using Ordina.Application.Orders;
using Ordina.Application.Reports;
using Ordina.Application.Security;
using Ordina.Application.Users;
using Ordina.Domain.Orders;
using Ordina.Infrastructure;
using Ordina.Infrastructure.Mongo;
using Xunit;

namespace Ordina.Api.Tests;

public class DependencyInjectionValidationTests
{
    private readonly IConfiguration _configuration;

    public DependencyInjectionValidationTests()
    {
        var baseDir = AppContext.BaseDirectory;
        var apiDir = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "src", "Api"));

        if (!Directory.Exists(apiDir))
        {
            var current = new DirectoryInfo(baseDir);
            while (current != null && !Directory.Exists(Path.Combine(current.FullName, "src", "Api")))
            {
                current = current.Parent;
            }

            if (current != null)
            {
                apiDir = Path.Combine(current.FullName, "src", "Api");
            }
        }

        var appsettingsPath = Path.Combine(apiDir, "appsettings.Development.json");
        _configuration = new ConfigurationBuilder()
            .AddJsonFile(appsettingsPath, optional: false)
            .Build();
    }

    [Fact]
    public void ServiceContainer_BuildsSuccessfully_WithScopeAndBuildValidation()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddMemoryCache();

        var envMock = new Moq.Mock<Microsoft.AspNetCore.Hosting.IWebHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Development");
        services.AddSingleton(envMock.Object);

        // Register application and infrastructure
        services.AddApplicationServices();
        services.AddInfrastructure(_configuration);

        // Register controllers directly to validate their constructor dependencies
        services.AddTransient<OrdersController>();
        services.AddTransient<ProductsController>();
        services.AddTransient<ClientsController>();
        services.AddTransient<CategoriesController>();
        services.AddTransient<StoresController>();
        services.AddTransient<UsersController>();
        services.AddTransient<ReportsController>();
        services.AddTransient<DashboardController>();

        var options = new ServiceProviderOptions
        {
            ValidateOnBuild = true,
            ValidateScopes = true
        };

        // Assert that container builds without throwing dependency resolution errors
        var provider = services.BuildServiceProvider(options);
        Assert.NotNull(provider);

        // Validate scoped resolution inside a scope
        using var scope = provider.CreateScope();
        var sp = scope.ServiceProvider;

        // Core Infrastructure
        Assert.NotNull(sp.GetRequiredService<IMongoClient>());
        Assert.NotNull(sp.GetRequiredService<MongoDbContext>());
        Assert.NotNull(sp.GetRequiredService<IMongoDatabase>());

        // Application Services
        Assert.NotNull(sp.GetRequiredService<IAuthService>());
        Assert.NotNull(sp.GetRequiredService<IUserService>());
        Assert.NotNull(sp.GetRequiredService<IClientService>());
        Assert.NotNull(sp.GetRequiredService<IProductService>());
        Assert.NotNull(sp.GetRequiredService<IOrderCoreService>());
        Assert.NotNull(sp.GetRequiredService<IManufacturingService>());
        Assert.NotNull(sp.GetRequiredService<IDispatchService>());
        Assert.NotNull(sp.GetRequiredService<IPaymentService>());
        Assert.NotNull(sp.GetRequiredService<IDashboardService>());
        Assert.NotNull(sp.GetRequiredService<IReportService>());

        // Controllers
        Assert.NotNull(sp.GetRequiredService<OrdersController>());
        Assert.NotNull(sp.GetRequiredService<ProductsController>());
        Assert.NotNull(sp.GetRequiredService<ClientsController>());
        Assert.NotNull(sp.GetRequiredService<CategoriesController>());
        Assert.NotNull(sp.GetRequiredService<StoresController>());
        Assert.NotNull(sp.GetRequiredService<UsersController>());
        Assert.NotNull(sp.GetRequiredService<ReportsController>());
        Assert.NotNull(sp.GetRequiredService<DashboardController>());
    }

    [Fact]
    public void ScopedServices_CannotBeResolvedDirectly_FromRootProvider()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddMemoryCache();
        services.AddApplicationServices();
        services.AddInfrastructure(_configuration);

        var options = new ServiceProviderOptions
        {
            ValidateOnBuild = true,
            ValidateScopes = true
        };

        var rootProvider = services.BuildServiceProvider(options);

        // Resolving a Scoped service directly from root MUST throw InvalidOperationException
        Assert.Throws<InvalidOperationException>(() =>
        {
            rootProvider.GetRequiredService<IOrderRepository>();
        });
    }
}
