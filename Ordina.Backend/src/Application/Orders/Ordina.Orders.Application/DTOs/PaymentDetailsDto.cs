namespace Ordina.Orders.Application.DTOs;

public class PaymentDetailsDto
{
    public string? PagomovilReference { get; set; }
    public string? PagomovilBank { get; set; }
    public string? PagomovilPhone { get; set; }
    public string? PagomovilDate { get; set; }
    public string? TransferenciaBank { get; set; }
    public string? TransferenciaReference { get; set; }
    public string? TransferenciaDate { get; set; }
    public string? CashAmount { get; set; }
    public string? CashCurrency { get; set; }
    public decimal? CashReceived { get; set; }
    public decimal? ExchangeRate { get; set; }
    public decimal? OriginalAmount { get; set; }
    public string? OriginalCurrency { get; set; }
    // Información de cuenta relacionada
    public string? AccountId { get; set; }
    public string? AccountNumber { get; set; }
    public string? Bank { get; set; }
    public string? Email { get; set; }
    public string? Wallet { get; set; }
    // Zelle
    public string? Envia { get; set; }
}

