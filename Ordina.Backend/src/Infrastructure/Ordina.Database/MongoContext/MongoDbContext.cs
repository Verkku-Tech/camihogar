using MongoDB.Driver;
using Ordina.Database.Entities.Account;
using Ordina.Database.Entities.Category;
using Ordina.Database.Entities.Client;
using Ordina.Database.Entities.Commission;
using Ordina.Database.Entities.Order;
using Ordina.Database.Entities.Payment;
using Ordina.Database.Entities.Product;
using Ordina.Database.Entities.Provider;
using Ordina.Database.Entities.RefreshToken;
using Ordina.Database.Entities.Store;
using Ordina.Database.Entities.User;
using Ordina.Database.Entities.Vendor;

namespace Ordina.Database.MongoContext;

public class MongoDbContext
{
    private readonly IMongoDatabase _database;

    public MongoDbContext(IMongoClient client, string databaseName)
    {
        _database = client.GetDatabase(databaseName);
    }

    public IMongoDatabase Database => _database;

    // Colecciones
    public IMongoCollection<Category> Categories =>
        _database.GetCollection<Category>("categories");

    public IMongoCollection<Product> Products =>
        _database.GetCollection<Product>("products");

    public IMongoCollection<Order> Orders =>
        _database.GetCollection<Order>("orders");

    public IMongoCollection<Client> Clients =>
        _database.GetCollection<Client>("clients");

    public IMongoCollection<Provider> Providers =>
        _database.GetCollection<Provider>("providers");

    public IMongoCollection<Store> Stores =>
        _database.GetCollection<Store>("stores");

    public IMongoCollection<Account> Accounts =>
        _database.GetCollection<Account>("accounts");

    public IMongoCollection<User> Users =>
        _database.GetCollection<User>("users");

    public IMongoCollection<Vendor> Vendors =>
        _database.GetCollection<Vendor>("vendors");

    public IMongoCollection<Payment> Payments =>
        _database.GetCollection<Payment>("payments");

    public IMongoCollection<PaymentMethod> PaymentMethods =>
        _database.GetCollection<PaymentMethod>("paymentMethods");

    public IMongoCollection<RefreshToken> RefreshTokens =>
        _database.GetCollection<RefreshToken>("refreshTokens");

    public IMongoCollection<Commission> Commissions =>
        _database.GetCollection<Commission>("commissions");

    public IMongoCollection<ProductCommission> ProductCommissions =>
        _database.GetCollection<ProductCommission>("productCommissions");

    public IMongoCollection<SaleTypeCommissionRule> SaleTypeCommissionRules =>
        _database.GetCollection<SaleTypeCommissionRule>("saleTypeCommissionRules");
}