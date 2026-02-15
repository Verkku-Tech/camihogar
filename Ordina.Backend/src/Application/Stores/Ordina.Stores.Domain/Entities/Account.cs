namespace Ordina.Stores.Domain.Entities;

public class Account
{
    public string Id { get; set; } = null!;
    public string Code { get; set; } = null!; // Código de la cuenta (ej: Banesco_POS)
    public string Label { get; set; } = null!; // Etiqueta o Nombre (ej: Punto de Venta Banesco)
    public string StoreId { get; set; } = null!; // ID de la tienda asociada
    public bool IsForeign { get; set; } // true = Extranjera, false = Nacional
    public string AccountType { get; set; } = null!; // "Cuentas Digitales", "Ahorro", "Corriente", etc.
    public string? Email { get; set; } // Correo (solo para cuentas digitales)
    public string? Wallet { get; set; } // Wallet (solo para cuentas digitales)
    public bool IsActive { get; set; } = true; // true = Activa, false = Inactiva
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}