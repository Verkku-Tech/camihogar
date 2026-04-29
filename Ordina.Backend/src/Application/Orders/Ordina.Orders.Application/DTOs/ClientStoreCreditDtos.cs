namespace Ordina.Orders.Application.DTOs;

public class ClientStoreCreditBalanceDto
{
    public decimal BalanceUsd { get; set; }
}

public class RecordOverpaymentCreditResponseDto
{
    public decimal AmountCreditedUsd { get; set; }
    public decimal NewBalanceUsd { get; set; }
}
