using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using Ordina.Application.Security;
using Ordina.Domain.Enums;
using Ordina.Domain.Security;
using Ordina.Domain.Users;

namespace Ordina.Infrastructure.Mongo;

public class MongoDatabaseSeeder
{
    private readonly MongoDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ILogger<MongoDatabaseSeeder> _logger;

    public MongoDatabaseSeeder(
        MongoDbContext context,
        IPasswordHasher passwordHasher,
        ILogger<MongoDatabaseSeeder> logger)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _logger = logger;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        await SeedRolesAsync(cancellationToken);
        await SeedAdminUserAsync(cancellationToken);
    }

    private async Task SeedRolesAsync(CancellationToken cancellationToken)
    {
        var count = await _context.Roles.CountDocumentsAsync(_ => true, cancellationToken: cancellationToken);

        var allPermissions = Permissions.GetAll();

        var roles = new List<Role>
        {
            new()
            {
                Name = "Super Administrator",
                Description = "Acceso irrestricto a todo el sistema",
                Permissions = allPermissions,
                IsSystem = true,
                IsActive = true
            },
            new()
            {
                Name = "Administrator",
                Description = "Gestión administrativa general",
                Permissions = allPermissions.Where(p => !p.Contains("delete")).ToList(),
                IsSystem = true,
                IsActive = true
            },
            new()
            {
                Name = "Supervisor",
                Description = "Supervisión de operaciones, órdenes y reportes",
                Permissions = new List<string>
                {
                    Permissions.Orders.Read,
                    Permissions.Orders.Create,
                    Permissions.Orders.Update,
                    Permissions.Budgets.ReadAll,
                    Permissions.Budgets.Create,
                    Permissions.Budgets.Update,
                    Permissions.Clients.Read,
                    Permissions.Products.Read,
                    Permissions.Reports.Dispatch,
                    Permissions.Reports.Commissions
                },
                IsSystem = true,
                IsActive = true
            },
            new()
            {
                Name = "Store Seller",
                Description = "Vendedor presencial de tienda",
                Permissions = new List<string>
                {
                    Permissions.Orders.Read,
                    Permissions.Orders.Create,
                    Permissions.Orders.Update,
                    Permissions.Orders.ManagePayments,
                    Permissions.Budgets.Create,
                    Permissions.Budgets.Update,
                    Permissions.Clients.Read,
                    Permissions.Clients.Create,
                    Permissions.Clients.Update,
                    Permissions.Products.Read
                },
                IsSystem = true,
                IsActive = true
            },
            new()
            {
                Name = "Online Seller",
                Description = "Vendedor del equipo remoto / redes",
                Permissions = new List<string>
                {
                    Permissions.Orders.Read,
                    Permissions.Orders.Create,
                    Permissions.Orders.Update,
                    Permissions.Orders.ManagePayments,
                    Permissions.Budgets.Create,
                    Permissions.Budgets.Update,
                    Permissions.Clients.Read,
                    Permissions.Clients.Create,
                    Permissions.Clients.Update,
                    Permissions.Products.Read
                },
                IsSystem = true,
                IsActive = true
            },
            new()
            {
                Name = "Workshop",
                Description = "Operador de taller y fabricación",
                Permissions = new List<string>
                {
                    Permissions.Manufacturing.Manage,
                    Permissions.Reports.Manufacturing
                },
                IsSystem = true,
                IsActive = true
            },
            new()
            {
                Name = "Dispatcher",
                Description = "Coordinador de logística y entregas",
                Permissions = new List<string>
                {
                    Permissions.Dispatch.Read,
                    Permissions.Dispatch.SendToRoute,
                    Permissions.Dispatch.ConfirmDelivery,
                    Permissions.Reports.Dispatch
                },
                IsSystem = true,
                IsActive = true
            }
        };

        if (count == 0)
        {
            _logger.LogInformation("Sembrando roles por defecto en MongoDB...");
            await _context.Roles.InsertManyAsync(roles, cancellationToken: cancellationToken);
            _logger.LogInformation("Se sembraron {Count} roles.", roles.Count);
        }
        else
        {
            // Sincroniza permisos faltantes en roles del sistema existentes
            foreach (var role in roles)
            {
                var existing = await _context.Roles.Find(r => r.Name == role.Name).FirstOrDefaultAsync(cancellationToken);
                if (existing == null)
                {
                    await _context.Roles.InsertOneAsync(role, cancellationToken: cancellationToken);
                    continue;
                }

                var currentPerms = existing.Permissions ?? new List<string>();
                var missing = role.Permissions.Where(p => !currentPerms.Contains(p)).ToList();
                if (missing.Count > 0)
                {
                    currentPerms.AddRange(missing);
                    var update = Builders<Role>.Update
                        .Set(r => r.Permissions, currentPerms)
                        .Set(r => r.UpdatedAt, DateTime.UtcNow);
                    await _context.Roles.UpdateOneAsync(r => r.Name == role.Name, update, cancellationToken: cancellationToken);
                    _logger.LogInformation("Rol '{RoleName}' actualizado con {Count} permisos adicionales.", role.Name, missing.Count);
                }
            }
        }
    }

    private async Task SeedAdminUserAsync(CancellationToken cancellationToken)
    {
        var count = await _context.Users.CountDocumentsAsync(_ => true, cancellationToken: cancellationToken);
        if (count > 0) return;

        _logger.LogInformation("Sembrando usuario Administrador inicial...");

        var adminUser = new User
        {
            Username = "admin",
            Email = "admin@camihogar.com",
            Name = "Administrador del Sistema",
            RoleString = "Super Administrator",
            StatusString = "active",
            PasswordHash = _passwordHasher.HashPassword("Admin123!"),
            CommissionExclusivityModeStored = "shared",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _context.Users.InsertOneAsync(adminUser, cancellationToken: cancellationToken);
        _logger.LogInformation("Usuario Administrador sembrado exitosamente: admin / admin@camihogar.com");
    }
}
