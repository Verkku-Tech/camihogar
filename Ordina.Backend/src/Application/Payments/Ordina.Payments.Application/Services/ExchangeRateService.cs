using Ordina.Payments.Application.Interfaces;
using Ordina.Payments.Domain.Entities;
using Ordina.Payments.Domain.Repositories;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Ordina.Payments.Application.Services
{
    public class ExchangeRateService : IExchangeRateService
    {
        private readonly IExchangeRateRepository _repository;

        public ExchangeRateService(IExchangeRateRepository repository)
        {
            _repository = repository;
        }

        public async Task<IEnumerable<ExchangeRate>> GetActiveRatesAsync()
        {
            return await _repository.GetAllActiveAsync();
        }

        public async Task<ExchangeRate?> GetLatestRateAsync(string fromCurrency, string toCurrency)
        {
            return await _repository.GetLatestRateAsync(fromCurrency, toCurrency);
        }

        public async Task<ExchangeRate> SetExchangeRateAsync(string fromCurrency, string toCurrency, decimal rate)
        {
            if (rate <= 0)
            {
                throw new ArgumentException("The exchange rate must be greater than zero.", nameof(rate));
            }

            if (fromCurrency == toCurrency)
            {
                throw new ArgumentException("Source and target currencies cannot be the same.");
            }

            // Deactivate previous rates for this pair
            await _repository.DeactivatePreviousRatesAsync(fromCurrency, toCurrency);

            var newRate = new ExchangeRate
            {
                // Let the repository/DB handle ID generation if possible, or generate here
                Id = Guid.NewGuid(),
                FromCurrency = fromCurrency,
                ToCurrency = toCurrency,
                Rate = rate,
                EffectiveDate = DateTime.UtcNow,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            await _repository.AddAsync(newRate);

            return newRate;
        }
    }
}
