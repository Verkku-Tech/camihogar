using MongoDB.Bson;
using MongoDB.Driver;
using Ordina.Database.Entities.Payment;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Seeders;

public static class PaymentMethodSeeder
{
    public static async Task SeedAsync(MongoDbContext context)
    {
        var collection = context.PaymentMethods;
        
        // Verificar si ya hay datos
        var existingCount = await collection.CountDocumentsAsync(_ => true);
        if (existingCount > 0)
        {
            return; // Ya hay datos, no hacer seed
        }

        var paymentMethods = new List<PaymentMethod>
        {
            new PaymentMethod
            {
                Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
                Name = "Efectivo",
                Type = "CASH",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new PaymentMethod
            {
                Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
                Name = "Tarjeta de Crédito",
                Type = "CREDIT_CARD",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new PaymentMethod
            {
                Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
                Name = "Tarjeta de Débito",
                Type = "DEBIT_CARD",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new PaymentMethod
            {
                Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
                Name = "Transferencia Bancaria",
                Type = "BANK_TRANSFER",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new PaymentMethod
            {
                Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
                Name = "Pago Móvil",
                Type = "PAGOMOVIL",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            },
            new PaymentMethod
            {
                Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
                Name = "Zelle",
                Type = "ZELLE",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            }
        };

        await collection.InsertManyAsync(paymentMethods);
    }
}

