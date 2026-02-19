using MongoDB.Driver;
using Ordina.Database.MongoContext;
using Ordina.Payments.Domain.Entities;
using Ordina.Payments.Domain.Repositories;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

// Alias to avoid ambiguity
using MongoExchangeRate = Ordina.Database.Entities.Payment.ExchangeRate;
using DomainExchangeRate = Ordina.Payments.Domain.Entities.ExchangeRate;

namespace Ordina.Payments.Infrastructure.Repositories
{
    public class ExchangeRateRepository : IExchangeRateRepository
    {
        private readonly MongoDbContext _context;

        public ExchangeRateRepository(MongoDbContext context)
        {
            _context = context;
        }

        private DomainExchangeRate MapToDomain(MongoExchangeRate mongoEntity)
        {
            if (mongoEntity == null) return null;

            return new DomainExchangeRate
            {
                Id = mongoEntity.Id,
                FromCurrency = mongoEntity.FromCurrency,
                ToCurrency = mongoEntity.ToCurrency,
                Rate = mongoEntity.Rate,
                EffectiveDate = mongoEntity.EffectiveDate,
                IsActive = mongoEntity.IsActive,
                CreatedAt = mongoEntity.CreatedAt
            };
        }

        private MongoExchangeRate MapToMongo(DomainExchangeRate domainEntity)
        {
            if (domainEntity == null) return null;

            return new MongoExchangeRate
            {
                Id = domainEntity.Id == Guid.Empty ? Guid.NewGuid() : domainEntity.Id,
                FromCurrency = domainEntity.FromCurrency,
                ToCurrency = domainEntity.ToCurrency,
                Rate = domainEntity.Rate,
                EffectiveDate = domainEntity.EffectiveDate,
                IsActive = domainEntity.IsActive,
                CreatedAt = domainEntity.CreatedAt
            };
        }

        public async Task<DomainExchangeRate?> GetByIdAsync(Guid id)
        {
            var filter = Builders<MongoExchangeRate>.Filter.Eq(r => r.Id, id);
            var result = await _context.ExchangeRates.Find(filter).FirstOrDefaultAsync();
            return MapToDomain(result);
        }

        public async Task<IEnumerable<DomainExchangeRate>> GetAllActiveAsync()
        {
            // Use Venezuela time (UTC-4) to determine "Today"
            var today = DateTime.UtcNow.AddHours(-4).Date;
            var filter = Builders<MongoExchangeRate>.Filter.And(
                Builders<MongoExchangeRate>.Filter.Eq(r => r.IsActive, true),
                Builders<MongoExchangeRate>.Filter.Gte(r => r.EffectiveDate, today)
            );
            var sort = Builders<MongoExchangeRate>.Sort.Descending(r => r.EffectiveDate);
            var results = await _context.ExchangeRates.Find(filter).Sort(sort).ToListAsync();
            
            return results.Select(MapToDomain);
        }

        public async Task<DomainExchangeRate?> GetLatestRateAsync(string fromCurrency, string toCurrency)
        {
            var today = DateTime.UtcNow.AddHours(-4).Date;
            var filter = Builders<MongoExchangeRate>.Filter.And(
                Builders<MongoExchangeRate>.Filter.Eq(r => r.FromCurrency, fromCurrency),
                Builders<MongoExchangeRate>.Filter.Eq(r => r.ToCurrency, toCurrency),
                Builders<MongoExchangeRate>.Filter.Eq(r => r.IsActive, true),
                Builders<MongoExchangeRate>.Filter.Gte(r => r.EffectiveDate, today)
            );
            
            var sort = Builders<MongoExchangeRate>.Sort.Descending(r => r.EffectiveDate);
            var result = await _context.ExchangeRates.Find(filter).Sort(sort).FirstOrDefaultAsync();
            
            return MapToDomain(result);
        }

        public async Task AddAsync(DomainExchangeRate exchangeRate)
        {
            var mongoEntity = MapToMongo(exchangeRate);
            await _context.ExchangeRates.InsertOneAsync(mongoEntity);
            // Update the domain entity ID if it was generated
            exchangeRate.Id = mongoEntity.Id;
        }

        public async Task UpdateAsync(DomainExchangeRate exchangeRate)
        {
            var mongoEntity = MapToMongo(exchangeRate);
            var filter = Builders<MongoExchangeRate>.Filter.Eq(r => r.Id, mongoEntity.Id);
            await _context.ExchangeRates.ReplaceOneAsync(filter, mongoEntity);
        }

        public async Task DeactivatePreviousRatesAsync(string fromCurrency, string toCurrency)
        {
            var filter = Builders<MongoExchangeRate>.Filter.And(
                Builders<MongoExchangeRate>.Filter.Eq(r => r.FromCurrency, fromCurrency),
                Builders<MongoExchangeRate>.Filter.Eq(r => r.ToCurrency, toCurrency),
                Builders<MongoExchangeRate>.Filter.Eq(r => r.IsActive, true)
            );

            var update = Builders<MongoExchangeRate>.Update.Set(r => r.IsActive, false);
            
            await _context.ExchangeRates.UpdateManyAsync(filter, update);
        }
    }
}
