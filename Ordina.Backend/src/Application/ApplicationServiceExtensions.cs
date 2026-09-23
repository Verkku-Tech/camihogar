using Microsoft.Extensions.DependencyInjection;
using Ordina.Application.Catalog;
using Ordina.Application.Clients;
using Ordina.Application.Dashboard;
using Ordina.Application.Dispatch;
using Ordina.Application.Finance;
using Ordina.Application.Manufacturing;
using Ordina.Application.Notifications;
using Ordina.Application.Orders;
using Ordina.Application.Reports;
using Ordina.Application.Security;
using Ordina.Application.Stores;
using Ordina.Application.Support;
using Ordina.Application.Users;

namespace Ordina.Application;

public static class ApplicationServiceExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddMemoryCache();

        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IRoleService, RoleService>();
        services.AddScoped<IClientService, ClientService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<ICategoryService, CategoryService>();
        services.AddScoped<IProviderService, ProviderService>();
        services.AddScoped<IOrderCoreService, OrderCoreService>();
        services.AddScoped<IOrderAuditLogService, OrderAuditLogService>();
        services.AddScoped<IManufacturingService, ManufacturingService>();
        services.AddScoped<IDispatchService, DispatchService>();
        services.AddScoped<IPaymentService, PaymentService>();
        services.AddScoped<IExchangeRateService, ExchangeRateService>();
        services.AddScoped<ICommissionService, CommissionService>();
        services.AddScoped<IStoreService, StoreService>();
        services.AddScoped<IAccountService, AccountService>();
        services.AddScoped<IReportService, ReportService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<INavigationSettingsService, NavigationSettingsService>();
        services.AddScoped<ISupportService, SupportService>();
        services.AddSingleton<ITimeSeriesForecastingService, HoltWintersForecastingService>();
        services.AddSingleton<INotificationService, NotificationService>();

        return services;
    }
}
