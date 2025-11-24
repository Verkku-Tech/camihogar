namespace Ordina.Payments.Domain;

public class PaymentMethod
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // Credit Card, Bank Transfer, etc.
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public virtual ICollection<Payment> Payments { get; set; } = new List<Payment>();
} 