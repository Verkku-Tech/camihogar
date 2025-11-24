using Microsoft.EntityFrameworkCore;
using Ordina.Users.Domain;

namespace Ordina.Users.Infrastructure;

public class UsersDbContext : DbContext
{
    public UsersDbContext(DbContextOptions<UsersDbContext> options) : base(options)
    {
    }

    // DbSets para las entidades del dominio Users
    public DbSet<User> Users { get; set; }
    public DbSet<UserProfile> UserProfiles { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Configurar schema específico
        modelBuilder.HasDefaultSchema("users");

        // Configuración de User
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Email).IsRequired().HasMaxLength(255);
            entity.Property(e => e.Username).IsRequired().HasMaxLength(100);
            entity.Property(e => e.FirstName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.LastName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.PasswordHash).IsRequired().HasMaxLength(500);
            entity.Property(e => e.RoleId);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("NOW()");

            // Índices
            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.Username).IsUnique();
            entity.HasIndex(e => e.RoleId);
            entity.HasIndex(e => e.CreatedAt);
        });

        // Configuración de UserProfile
        modelBuilder.Entity<UserProfile>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Bio).HasMaxLength(1000);
            entity.Property(e => e.PhoneNumber).HasMaxLength(20);
            entity.Property(e => e.Address).HasMaxLength(500);
            entity.Property(e => e.DateOfBirth);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("NOW()");

            // Relación uno-a-uno con User
            entity.HasOne(p => p.User)
                .WithOne(u => u.Profile)
                .HasForeignKey<UserProfile>(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Índices
            entity.HasIndex(e => e.UserId).IsUnique();
            entity.HasIndex(e => e.CreatedAt);
        });

        // Datos semilla para development
        // Password: "password123" hasheado con SHA256
        modelBuilder.Entity<User>().HasData(
            new User
            {
                Id = Guid.Parse("99999999-9999-9999-9999-999999999999"),
                Email = "admin@ordina.com",
                Username = "admin",
                FirstName = "Sistema",
                LastName = "Administrador",
                PasswordHash = "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f", // password123
                RoleId = Guid.Parse("11111111-1111-1111-1111-111111111111"), // Super Administrator
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new User
            {
                Id = Guid.Parse("88888888-8888-8888-8888-888888888888"),
                Email = "manager@ordina.com",
                Username = "manager",
                FirstName = "Juan",
                LastName = "Gerente",
                PasswordHash = "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f", // password123
                RoleId = Guid.Parse("33333333-3333-3333-3333-333333333333"), // Supervisor
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        );

        base.OnModelCreating(modelBuilder);
    }
} 