using Ordina.Payments.Domain.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Ordina.Payments.Application.Interfaces
{
    public interface IExchangeRateService
    {
        Task<IEnumerable<ExchangeRate>> GetActiveRatesAsync();
        Task<ExchangeRate> SetExchangeRateAsync(string fromCurrency, string toCurrency, decimal rate);
        Task<ExchangeRate?> GetLatestRateAsync(string fromCurrency, string toCurrency);
    }
}
