namespace Ordina.Payments.Domain;

public class Payment
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public string Status { get; set; } = "Pending";
    public string? TransactionId { get; set; }
    public Guid PaymentMethodId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Navigation properties
    public virtual PaymentMethod PaymentMethod { get; set; } = null!;
} 