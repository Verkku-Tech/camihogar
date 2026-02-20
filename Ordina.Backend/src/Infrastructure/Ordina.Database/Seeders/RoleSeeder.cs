using MongoDB.Driver;
using Ordina.Database.Entities.Role;
using Ordina.Database.MongoContext;
using Ordina.Users.Domain.Constants;

namespace Ordina.Database.Seeders;

public static class RoleSeeder
{
    public static async Task SeedAsync(MongoDbContext context)
    {
        var collection = context.Roles;

        var rolesKeyed = new Dictionary<string, Role>
        {
            ["Super Administrator"] = new Role
            {
                Name = "Super Administrator",
                IsSystem = true,
                Permissions = Permissions.GetAll(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            ["Administrator"] = new Role
            {
                Name = "Administrator",
                IsSystem = true,
                Permissions = Permissions.GetAll().Where(p => !p.Contains("settings.system")).ToList(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            ["Supervisor"] = new Role
            {
                Name = "Supervisor",
                IsSystem = true,
                Permissions = new List<string>
                {
                    Permissions.Users.Read,
                    Permissions.Clients.Read, Permissions.Clients.Create, Permissions.Clients.Update,
                    Permissions.Inventory.ViewStock, Permissions.Inventory.ViewMovements,
                    Permissions.Products.Read,
                    Permissions.Settings.ManageAlerts,
                    Permissions.Budgets.ReadAll, Permissions.Budgets.Create, Permissions.Budgets.Update, Permissions.Budgets.Close,
                    Permissions.Orders.Read, Permissions.Orders.Create, Permissions.Orders.Update, Permissions.Orders.Export,
                    Permissions.Dispatch.Read, Permissions.Dispatch.Create, Permissions.Dispatch.Update,
                    Permissions.Reports.Dispatch, Permissions.Reports.Commissions
                },
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            ["Store Seller"] = new Role
            {
                Name = "Store Seller",
                IsSystem = true,
                Permissions = new List<string>
                {
                    Permissions.Clients.Read,
                    Permissions.Inventory.ViewStock,
                    Permissions.Products.Read,
                    Permissions.Settings.ManageAlerts,
                    Permissions.Budgets.Create, Permissions.Budgets.Update, Permissions.Budgets.Close,
                    Permissions.Orders.Read, Permissions.Orders.Create, Permissions.Orders.Update, Permissions.Orders.Export,
                    Permissions.Dispatch.Read, Permissions.Dispatch.Create, Permissions.Dispatch.Update
                },
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            ["Online Seller"] = new Role
            {
                Name = "Online Seller",
                IsSystem = true,
                Permissions = new List<string>
                {
                    Permissions.Clients.Read,
                    Permissions.Inventory.ViewStock,
                    Permissions.Products.Read,
                    Permissions.Settings.ManageAlerts,
                    Permissions.Budgets.Create, Permissions.Budgets.Update, Permissions.Budgets.Close,
                    Permissions.Orders.Read, Permissions.Orders.Create, Permissions.Orders.Update, Permissions.Orders.Export,
                    Permissions.Dispatch.Read, Permissions.Dispatch.Create, Permissions.Dispatch.Update
                },
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };

        foreach (var roleEntry in rolesKeyed)
        {
            var exists = await collection.Find(r => r.Name == roleEntry.Key).AnyAsync();
            if (!exists)
            {
                await collection.InsertOneAsync(roleEntry.Value);
            }
        }
    }
}
