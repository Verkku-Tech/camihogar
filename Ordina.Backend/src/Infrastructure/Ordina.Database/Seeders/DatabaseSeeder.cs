using Ordina.Database.MongoContext;

namespace Ordina.Database.Seeders;

public static class DatabaseSeeder
{
    public static async Task SeedAllAsync(MongoDbContext context)
    {
        await PaymentMethodSeeder.SeedAsync(context);
        await VendorSeeder.SeedAsync(context);
        await UserSeeder.SeedAsync(context);
        // Agregar más seeders aquí cuando los crees
    }
}

