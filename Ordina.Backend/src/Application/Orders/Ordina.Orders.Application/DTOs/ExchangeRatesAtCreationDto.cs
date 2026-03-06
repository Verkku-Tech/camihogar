namespace Ordina.Orders.Application.DTOs;

public class ExchangeRatesAtCreationDto
{
    public ExchangeRateInfoDto? Usd { get; set; }
    public ExchangeRateInfoDto? Eur { get; set; }
}

public class ExchangeRateInfoDto
{
    public decimal Rate { get; set; }
    public string EffectiveDate { get; set; } = string.Empty;
}
