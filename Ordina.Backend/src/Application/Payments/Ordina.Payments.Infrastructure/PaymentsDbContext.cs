using Microsoft.EntityFrameworkCore;
using Ordina.Payments.Domain;
using Ordina.Payments.Domain.Entities;

namespace Ordina.Payments.Infrastructure;

public class PaymentsDbContext : DbContext
{
    public PaymentsDbContext(DbContextOptions<PaymentsDbContext> options) : base(options)
    {
    }

    // DbSets para las entidades del dominio Payments
    public DbSet<Payment> Payments { get; set; }
    public DbSet<PaymentMethod> PaymentMethods { get; set; }
    public DbSet<ExchangeRate> ExchangeRates { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Configurar schema específico
        modelBuilder.HasDefaultSchema("payments");

        // Configuración de Payment
        modelBuilder.Entity<Payment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.OrderId).IsRequired();
            entity.Property(e => e.Amount).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Currency).IsRequired().HasMaxLength(3);
            entity.Property(e => e.Status).IsRequired().HasMaxLength(50);
            entity.Property(e => e.TransactionId).HasMaxLength(200);
            entity.Property(e => e.PaymentMethodId).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("NOW()");

            // Relación con PaymentMethod
            entity.HasOne(p => p.PaymentMethod)
                .WithMany(pm => pm.Payments)
                .HasForeignKey(p => p.PaymentMethodId)
                .OnDelete(DeleteBehavior.Restrict);

            // Índices
            entity.HasIndex(e => e.OrderId);
            entity.HasIndex(e => e.TransactionId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => e.PaymentMethodId);
        });

        // Configuración de PaymentMethod
        modelBuilder.Entity<PaymentMethod>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Type).IsRequired().HasMaxLength(50);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("NOW()");

            // Índices
            entity.HasIndex(e => e.Name).IsUnique();
            entity.HasIndex(e => e.Type);
            entity.HasIndex(e => e.CreatedAt);
        });

        // Configuración de ExchangeRate
        modelBuilder.Entity<ExchangeRate>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.FromCurrency).IsRequired().HasMaxLength(3);
            entity.Property(e => e.ToCurrency).IsRequired().HasMaxLength(3);
            entity.Property(e => e.Rate).HasColumnType("decimal(18,4)");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");

            // Índices
            entity.HasIndex(e => e.IsActive);
            entity.HasIndex(e => new { e.FromCurrency, e.ToCurrency, e.IsActive });
        });

        // Datos semilla para development
        modelBuilder.Entity<PaymentMethod>().HasData(
            new PaymentMethod
            {
                Id = Guid.Parse("11111111-aaaa-bbbb-cccc-111111111111"),
                Name = "Efectivo",
                Type = "CASH",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new PaymentMethod
            {
                Id = Guid.Parse("22222222-aaaa-bbbb-cccc-222222222222"),
                Name = "Tarjeta de Crédito",
                Type = "CREDIT_CARD",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new PaymentMethod
            {
                Id = Guid.Parse("33333333-aaaa-bbbb-cccc-333333333333"),
                Name = "Transferencia Bancaria",
                Type = "BANK_TRANSFER",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        );

        base.OnModelCreating(modelBuilder);
    }
} 