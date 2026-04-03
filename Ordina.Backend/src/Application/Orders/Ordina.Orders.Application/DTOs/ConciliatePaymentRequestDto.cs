namespace Ordina.Orders.Application.DTOs;

public class ConciliatePaymentRequestDto
{
    public string OrderId { get; set; } = string.Empty;
    public string PaymentType { get; set; } = string.Empty; // "main", "partial", "mixed"
    public int PaymentIndex { get; set; } = -1;
    public bool IsConciliated { get; set; }
}
