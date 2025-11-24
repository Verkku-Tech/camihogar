using Ordina.Database.Indexes;
using Ordina.Database.Seeders;

namespace Ordina.Database.MongoContext;

public static class MongoDbContextExtensions
{
    /// <summary>
    /// Inicializa la base de datos: crea índices y ejecuta seeders
    /// </summary>
    public static async Task InitializeAsync(this MongoDbContext context)
    {
        // Crear todos los índices
        IndexManager.CreateAllIndexes(context);

        // Ejecutar seeders
        await DatabaseSeeder.SeedAllAsync(context);
    }
}

