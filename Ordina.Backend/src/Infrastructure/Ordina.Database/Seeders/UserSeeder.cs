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
        
        // Verificar si ya hay datos
        var existingCount = await collection.CountDocumentsAsync(_ => true);
        if (existingCount > 0)
        {
            return; // Ya hay datos, no hacer seed
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

        await collection.InsertManyAsync(users);
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

