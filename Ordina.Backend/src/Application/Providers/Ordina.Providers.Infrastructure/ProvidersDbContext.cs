using Microsoft.EntityFrameworkCore;
using Ordina.Providers.Domain;

namespace Ordina.Providers.Infrastructure;

public class ProvidersDbContext : DbContext
{
    public ProvidersDbContext(DbContextOptions<ProvidersDbContext> options) : base(options)
    {
    }

    // DbSets para las entidades del dominio Providers
    public DbSet<Provider> Providers { get; set; }
    public DbSet<Product> Products { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Configurar schema específico
        modelBuilder.HasDefaultSchema("providers");

        // Configuración de Provider
        modelBuilder.Entity<Provider>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(255);
            entity.Property(e => e.Phone).HasMaxLength(20);
            entity.Property(e => e.Address).HasMaxLength(500);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("NOW()");

            // Índices
            entity.HasIndex(e => e.Name);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.CreatedAt);
        });

        // Configuración de Product
        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.ProviderId).IsRequired();
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.Price).HasColumnType("decimal(18,2)");
            entity.Property(e => e.SKU).IsRequired().HasMaxLength(100);
            entity.Property(e => e.StockQuantity).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("NOW()");

            // Relación con Provider
            entity.HasOne(p => p.Provider)
                .WithMany(pr => pr.Products)
                .HasForeignKey(p => p.ProviderId)
                .OnDelete(DeleteBehavior.Cascade);

            // Índices
            entity.HasIndex(e => e.SKU).IsUnique();
            entity.HasIndex(e => e.Name);
            entity.HasIndex(e => e.ProviderId);
            entity.HasIndex(e => e.CreatedAt);
        });

        // Datos semilla para development
        modelBuilder.Entity<Provider>().HasData(
            new Provider
            {
                Id = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff"),
                Name = "Proveedor Principal",
                Email = "contacto@distribuidora.com",
                Phone = "+1234567890",
                Address = "Av. Principal 123, Ciudad",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        );

        base.OnModelCreating(modelBuilder);
    }
} 