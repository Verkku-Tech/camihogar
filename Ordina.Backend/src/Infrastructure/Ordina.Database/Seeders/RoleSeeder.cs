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
                    Permissions.Budgets.ReadAll, Permissions.Budgets.Create, Permissions.Budgets.Update, Permissions.Budgets.ConvertToOrder, Permissions.Budgets.Close,
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
                    Permissions.Clients.Read, Permissions.Clients.Create, Permissions.Clients.Update,
                    Permissions.Inventory.ViewStock,
                    Permissions.Products.Read,
                    Permissions.Settings.ManageAlerts,
                    Permissions.Budgets.Create, Permissions.Budgets.Update, Permissions.Budgets.ConvertToOrder, Permissions.Budgets.Close,
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
                    Permissions.Clients.Read, Permissions.Clients.Create, Permissions.Clients.Update,
                    Permissions.Inventory.ViewStock,
                    Permissions.Products.Read,
                    Permissions.Settings.ManageAlerts,
                    Permissions.Budgets.Create, Permissions.Budgets.Update, Permissions.Budgets.ConvertToOrder, Permissions.Budgets.Close,
                    Permissions.Orders.Read, Permissions.Orders.Create, Permissions.Orders.Update, Permissions.Orders.Export,
                    Permissions.Orders.ManagePayments,
                    // Solo lectura de despachos; mutación (A ruta / Entregar / Devolver) solo Administrador / Super Administrador (UI + API).
                    Permissions.Dispatch.Read,
                },
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };

        // Sincroniza permisos faltantes en roles ya existentes (p.ej. clients.create/update para vendedores)
        // y elimina permisos obsoletos de Online Seller. No sobrescribe permisos extra asignados manualmente.

        foreach (var roleEntry in rolesKeyed)
        {
            var existing = await collection.Find(r => r.Name == roleEntry.Key).FirstOrDefaultAsync();
            if (existing == null)
            {
                await collection.InsertOneAsync(roleEntry.Value);
                continue;
            }

            var permissions = existing.Permissions ?? new List<string>();
            var toAdd = roleEntry.Value.Permissions.Where(p => !permissions.Contains(p)).ToList();

            // Online Seller: remover dispatch.create/update si quedaron de una versión anterior
            var toRemove = new List<string>();
            if (roleEntry.Key == "Online Seller")
            {
                if (permissions.Contains(Permissions.Dispatch.Create)) toRemove.Add(Permissions.Dispatch.Create);
                if (permissions.Contains(Permissions.Dispatch.Update)) toRemove.Add(Permissions.Dispatch.Update);
            }

            if (toAdd.Count == 0 && toRemove.Count == 0) continue;

            foreach (var p in toAdd) permissions.Add(p);
            foreach (var p in toRemove) permissions.Remove(p);

            var update = Builders<Role>.Update
                .Set(r => r.Permissions, permissions)
                .Set(r => r.UpdatedAt, DateTime.UtcNow);
            await collection.UpdateOneAsync(r => r.Name == roleEntry.Key, update);
        }
    }
}
