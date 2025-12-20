namespace Ordina.Orders.Application.DTOs;

public class PartialPaymentDto
{
    public string Id { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Method { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public PaymentDetailsDto? PaymentDetails { get; set; }
}

