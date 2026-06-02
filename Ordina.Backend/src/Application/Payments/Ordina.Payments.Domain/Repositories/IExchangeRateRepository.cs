using Ordina.Payments.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Ordina.Payments.Domain.Repositories
{
    public interface IExchangeRateRepository
    {
        Task<ExchangeRate?> GetByIdAsync(Guid id);
        Task<IEnumerable<ExchangeRate>> GetAllActiveAsync();
        Task<ExchangeRate?> GetLatestRateAsync(string fromCurrency, string toCurrency);
        /// <summary>Última tasa con EffectiveDate &lt;= asOfDate (incluye tasas ya desactivadas).</summary>
        Task<ExchangeRate?> GetRateForDateAsync(string fromCurrency, string toCurrency, DateTime asOfDate);
        Task<IEnumerable<ExchangeRate>> GetHistoryAsync(int days = 30);
        Task AddAsync(ExchangeRate exchangeRate);
        Task UpdateAsync(ExchangeRate exchangeRate);
        Task DeactivatePreviousRatesAsync(string fromCurrency, string toCurrency);
    }
}
