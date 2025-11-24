using MongoDB.Driver;
using Ordina.Database.Entities.Category;
using Ordina.Database.Entities.Client;
using Ordina.Database.Entities.Order;
using Ordina.Database.Entities.Payment;
using Ordina.Database.Entities.Product;
using Ordina.Database.Entities.Provider;
using Ordina.Database.Entities.Store;
using Ordina.Database.Entities.User;
using Ordina.Database.Entities.Vendor;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Indexes;

public static class IndexManager
{
    public static void CreateAllIndexes(MongoDbContext context)
    {
        CreateCategoryIndexes(context.Categories);
        CreateProductIndexes(context.Products);
        CreateOrderIndexes(context.Orders);
        CreateClientIndexes(context.Clients);
        CreateProviderIndexes(context.Providers);
        CreateStoreIndexes(context.Stores);
        CreateUserIndexes(context.Users);
        CreateVendorIndexes(context.Vendors);
        CreatePaymentIndexes(context.Payments);
        CreatePaymentMethodIndexes(context.PaymentMethods);
    }

    private static void CreateCategoryIndexes(IMongoCollection<Category> collection)
    {
        // Índice único en Name
        collection.Indexes.CreateOne(
            new CreateIndexModel<Category>(
                Builders<Category>.IndexKeys.Ascending(x => x.Name),
                new CreateIndexOptions { Unique = true, Name = "idx_category_name_unique" }
            )
        );
    }

    private static void CreateProductIndexes(IMongoCollection<Product> collection)
    {
        // Índice único en SKU
        collection.Indexes.CreateOne(
            new CreateIndexModel<Product>(
                Builders<Product>.IndexKeys.Ascending(x => x.SKU),
                new CreateIndexOptions { Unique = true, Name = "idx_product_sku_unique" }
            )
        );

        // Índice en CategoryId para búsquedas por categoría
        collection.Indexes.CreateOne(
            new CreateIndexModel<Product>(
                Builders<Product>.IndexKeys.Ascending(x => x.CategoryId),
                new CreateIndexOptions { Name = "idx_product_categoryId" }
            )
        );

        // Índice en Status
        collection.Indexes.CreateOne(
            new CreateIndexModel<Product>(
                Builders<Product>.IndexKeys.Ascending(x => x.Status),
                new CreateIndexOptions { Name = "idx_product_status" }
            )
        );
    }

    private static void CreateOrderIndexes(IMongoCollection<Order> collection)
    {
        // Índice único en OrderNumber
        collection.Indexes.CreateOne(
            new CreateIndexModel<Order>(
                Builders<Order>.IndexKeys.Ascending(x => x.OrderNumber),
                new CreateIndexOptions { Unique = true, Name = "idx_order_orderNumber_unique" }
            )
        );

        // Índice en ClientId para búsquedas por cliente
        collection.Indexes.CreateOne(
            new CreateIndexModel<Order>(
                Builders<Order>.IndexKeys.Ascending(x => x.ClientId),
                new CreateIndexOptions { Name = "idx_order_clientId" }
            )
        );

        // Índice en Status
        collection.Indexes.CreateOne(
            new CreateIndexModel<Order>(
                Builders<Order>.IndexKeys.Ascending(x => x.Status),
                new CreateIndexOptions { Name = "idx_order_status" }
            )
        );

        // Índice en CreatedAt para ordenamiento
        collection.Indexes.CreateOne(
            new CreateIndexModel<Order>(
                Builders<Order>.IndexKeys.Descending(x => x.CreatedAt),
                new CreateIndexOptions { Name = "idx_order_createdAt" }
            )
        );
    }

    private static void CreateClientIndexes(IMongoCollection<Client> collection)
    {
        // Índice único en RutId
        collection.Indexes.CreateOne(
            new CreateIndexModel<Client>(
                Builders<Client>.IndexKeys.Ascending(x => x.RutId),
                new CreateIndexOptions { Unique = true, Name = "idx_client_rutId_unique" }
            )
        );

        // Índice en Estado
        collection.Indexes.CreateOne(
            new CreateIndexModel<Client>(
                Builders<Client>.IndexKeys.Ascending(x => x.Estado),
                new CreateIndexOptions { Name = "idx_client_estado" }
            )
        );
    }

    private static void CreateProviderIndexes(IMongoCollection<Provider> collection)
    {
        // Índice único en Rif
        collection.Indexes.CreateOne(
            new CreateIndexModel<Provider>(
                Builders<Provider>.IndexKeys.Ascending(x => x.Rif),
                new CreateIndexOptions { Unique = true, Name = "idx_provider_rif_unique" }
            )
        );

        // Índice en Email
        collection.Indexes.CreateOne(
            new CreateIndexModel<Provider>(
                Builders<Provider>.IndexKeys.Ascending(x => x.Email),
                new CreateIndexOptions { Unique = true, Name = "idx_provider_email_unique" }
            )
        );

        // Índice en Estado
        collection.Indexes.CreateOne(
            new CreateIndexModel<Provider>(
                Builders<Provider>.IndexKeys.Ascending(x => x.Estado),
                new CreateIndexOptions { Name = "idx_provider_estado" }
            )
        );
    }

    private static void CreateStoreIndexes(IMongoCollection<Store> collection)
    {
        // Índice único en Code
        collection.Indexes.CreateOne(
            new CreateIndexModel<Store>(
                Builders<Store>.IndexKeys.Ascending(x => x.Code),
                new CreateIndexOptions { Unique = true, Name = "idx_store_code_unique" }
            )
        );

        // Índice en Status
        collection.Indexes.CreateOne(
            new CreateIndexModel<Store>(
                Builders<Store>.IndexKeys.Ascending(x => x.Status),
                new CreateIndexOptions { Name = "idx_store_status" }
            )
        );
    }

    private static void CreateUserIndexes(IMongoCollection<User> collection)
    {
        // Índice único en Username
        collection.Indexes.CreateOne(
            new CreateIndexModel<User>(
                Builders<User>.IndexKeys.Ascending(x => x.Username),
                new CreateIndexOptions { Unique = true, Name = "idx_user_username_unique" }
            )
        );

        // Índice único en Email
        collection.Indexes.CreateOne(
            new CreateIndexModel<User>(
                Builders<User>.IndexKeys.Ascending(x => x.Email),
                new CreateIndexOptions { Unique = true, Name = "idx_user_email_unique" }
            )
        );

        // Índice en Status
        collection.Indexes.CreateOne(
            new CreateIndexModel<User>(
                Builders<User>.IndexKeys.Ascending(x => x.Status),
                new CreateIndexOptions { Name = "idx_user_status" }
            )
        );
    }

    private static void CreateVendorIndexes(IMongoCollection<Vendor> collection)
    {
        // Índice en Type para filtrar vendedores vs referrers
        collection.Indexes.CreateOne(
            new CreateIndexModel<Vendor>(
                Builders<Vendor>.IndexKeys.Ascending(x => x.Type),
                new CreateIndexOptions { Name = "idx_vendor_type" }
            )
        );
    }

    private static void CreatePaymentIndexes(IMongoCollection<Payment> collection)
    {
        // Índice en OrderId para búsquedas por pedido
        collection.Indexes.CreateOne(
            new CreateIndexModel<Payment>(
                Builders<Payment>.IndexKeys.Ascending(x => x.OrderId),
                new CreateIndexOptions { Name = "idx_payment_orderId" }
            )
        );

        // Índice en Status
        collection.Indexes.CreateOne(
            new CreateIndexModel<Payment>(
                Builders<Payment>.IndexKeys.Ascending(x => x.Status),
                new CreateIndexOptions { Name = "idx_payment_status" }
            )
        );

        // Índice en TransactionId (si existe)
        collection.Indexes.CreateOne(
            new CreateIndexModel<Payment>(
                Builders<Payment>.IndexKeys.Ascending(x => x.TransactionId),
                new CreateIndexOptions { Name = "idx_payment_transactionId", Sparse = true }
            )
        );
    }

    private static void CreatePaymentMethodIndexes(IMongoCollection<PaymentMethod> collection)
    {
        // Índice único en Name
        collection.Indexes.CreateOne(
            new CreateIndexModel<PaymentMethod>(
                Builders<PaymentMethod>.IndexKeys.Ascending(x => x.Name),
                new CreateIndexOptions { Unique = true, Name = "idx_paymentMethod_name_unique" }
            )
        );

        // Índice en Type
        collection.Indexes.CreateOne(
            new CreateIndexModel<PaymentMethod>(
                Builders<PaymentMethod>.IndexKeys.Ascending(x => x.Type),
                new CreateIndexOptions { Name = "idx_paymentMethod_type" }
            )
        );
    }
}

