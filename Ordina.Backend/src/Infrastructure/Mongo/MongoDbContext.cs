using Microsoft.Extensions.Configuration;
using MongoDB.Driver;
using Ordina.Domain.Catalog;
using Ordina.Domain.Common;
using Ordina.Domain.Dispatch;
using Ordina.Domain.Finance;
using Ordina.Domain.Inventory;
using Ordina.Domain.Manufacturing;
using Ordina.Domain.Orders;
using Ordina.Domain.Security;
using Ordina.Domain.Stores;
using Ordina.Domain.Users;

namespace Ordina.Infrastructure.Mongo;

public class MongoDbContext
{
    private readonly IMongoDatabase _database;

    public MongoDbContext(IMongoClient client, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("MongoDB");

        string? dbFromUrl = null;
        try
        {
            var url = new MongoUrl(connectionString);
            dbFromUrl = url.DatabaseName;
        }
        catch
        {
            // Fallback if not a standard URL
        }

        var dbName = !string.IsNullOrWhiteSpace(dbFromUrl)
            ? dbFromUrl
            : configuration["ConnectionStrings:DatabaseName"]
              ?? configuration["MongoDb:DatabaseName"]
              ?? configuration["DatabaseName"]
              ?? throw new InvalidOperationException("DatabaseName is not configured in ConnectionStrings:MongoDB or ConnectionStrings:DatabaseName.");

        _database = client.GetDatabase(dbName);
    }

    public IMongoDatabase Database => _database;

    public IMongoCollection<Order> Orders => _database.GetCollection<Order>("orders");
    public IMongoCollection<User> Users => _database.GetCollection<User>("users");
    public IMongoCollection<Role> Roles => _database.GetCollection<Role>("roles");
    public IMongoCollection<Client> Clients => _database.GetCollection<Client>("clients");
    public IMongoCollection<Product> Products => _database.GetCollection<Product>("products");
    public IMongoCollection<Category> Categories => _database.GetCollection<Category>("categories");
    public IMongoCollection<Provider> Providers => _database.GetCollection<Provider>("providers");
    public IMongoCollection<Payment> Payments => _database.GetCollection<Payment>("payments");
    public IMongoCollection<PaymentMethod> PaymentMethods => _database.GetCollection<PaymentMethod>("paymentMethods");
    public IMongoCollection<ExchangeRate> ExchangeRates => _database.GetCollection<ExchangeRate>("exchangeRates");
    public IMongoCollection<Commission> Commissions => _database.GetCollection<Commission>("commissions");
    public IMongoCollection<ProductCommission> ProductCommissions => _database.GetCollection<ProductCommission>("productCommissions");
    public IMongoCollection<SaleTypeCommissionRule> SaleTypeCommissionRules => _database.GetCollection<SaleTypeCommissionRule>("saleTypeCommissionRules");
    public IMongoCollection<Store> Stores => _database.GetCollection<Store>("stores");
    public IMongoCollection<Warehouse> Warehouses => _database.GetCollection<Warehouse>("warehouses");
    public IMongoCollection<PhysicalStock> PhysicalStocks => _database.GetCollection<PhysicalStock>("physical_stocks");
    public IMongoCollection<Account> Accounts => _database.GetCollection<Account>("accounts");
    public IMongoCollection<DispatchRoute> DispatchRoutes => _database.GetCollection<DispatchRoute>("dispatch_routes");
    public IMongoCollection<WorkOrder> WorkOrders => _database.GetCollection<WorkOrder>("work_orders");
    public IMongoCollection<RefreshToken> RefreshTokens => _database.GetCollection<RefreshToken>("refreshTokens");
    public IMongoCollection<IdempotencyRecord> IdempotencyRecords => _database.GetCollection<IdempotencyRecord>("idempotency_keys");
    public IMongoCollection<AccessPin> AccessPins => _database.GetCollection<AccessPin>("accessPins");
    public IMongoCollection<OrderAuditLog> OrderAuditLogs => _database.GetCollection<OrderAuditLog>("orderAuditLogs");
    public IMongoCollection<Ordina.Domain.Dashboard.SalesForecastRecord> SalesProjections => _database.GetCollection<Ordina.Domain.Dashboard.SalesForecastRecord>("sales_projections");
}
