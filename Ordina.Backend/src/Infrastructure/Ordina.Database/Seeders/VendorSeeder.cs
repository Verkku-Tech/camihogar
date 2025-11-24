using MongoDB.Bson;
using MongoDB.Driver;
using Ordina.Database.Entities.Vendor;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Seeders;

public static class VendorSeeder
{
    public static async Task SeedAsync(MongoDbContext context)
    {
        var collection = context.Vendors;
        
        // Verificar si ya hay datos
        var existingCount = await collection.CountDocumentsAsync(_ => true);
        if (existingCount > 0)
        {
            return; // Ya hay datos, no hacer seed
        }

        var vendors = new List<Vendor>
        {
            new Vendor
            {
                Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
                Name = "Juan Pérez",
                Role = "Vendedor de tienda",
                Type = "vendor"
            },
            new Vendor
            {
                Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
                Name = "Ana López",
                Role = "Vendedor de tienda",
                Type = "vendor"
            },
            new Vendor
            {
                Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
                Name = "Carlos Silva",
                Role = "Vendedor de tienda",
                Type = "vendor"
            },
            new Vendor
            {
                Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
                Name = "María González",
                Role = "Vendedor Online",
                Type = "referrer"
            },
            new Vendor
            {
                Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
                Name = "Pedro Martínez",
                Role = "Vendedor Online",
                Type = "referrer"
            },
            new Vendor
            {
                Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
                Name = "Laura Rodríguez",
                Role = "Vendedor Online",
                Type = "referrer"
            }
        };

        await collection.InsertManyAsync(vendors);
    }
}

