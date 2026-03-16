using MongoDB.Driver;
using Ordina.Database.Entities.User;
using Ordina.Database.MongoContext;
using System.Security.Cryptography;
using System.Text;

namespace Ordina.Database.Seeders;

public static class UserSeeder
{
    public static async Task SeedAsync(MongoDbContext context)
    {
        var collection = context.Users;
        
        // Verificar si ya existe el administrador para evitar duplicados
        var adminExists = await collection.Find(u => u.Username == "admin").AnyAsync();
        if (adminExists)
        {
            return; // Ya existe el administrador o hay datos
        }

        // Hashear la contraseña "password123" con SHA256
        var passwordHash = HashPassword("password123");

        var users = new List<User>
        {
            new User
            {
                Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
                Username = "admin",
                Email = "admin@ordina.com",
                Name = "Administrador del Sistema",
                Role = "Super Administrator",
                Status = "active",
                PasswordHash = passwordHash,
                CreatedAt = DateTime.UtcNow
            }
        };

        try
        {
            await collection.InsertManyAsync(users);
        }
        catch (MongoBulkWriteException ex) when (ex.WriteErrors.Any(e => e.Code == 11000))
        {
            // Ignorar error de clave duplicada: otro nodo/instancia ya lo insertó en paralelo
        }
    }

    /// <summary>
    /// Hashea una contraseña usando SHA256 (igual que UserService y AuthService para mantener consistencia)
    /// </summary>
    private static string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
        var hashedPassword = BitConverter.ToString(hashedBytes).Replace("-", "").ToLowerInvariant();
        
        return hashedPassword;
    }
}

