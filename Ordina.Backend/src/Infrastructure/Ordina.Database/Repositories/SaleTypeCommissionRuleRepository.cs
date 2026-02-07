using MongoDB.Driver;
using Ordina.Database.Entities.Commission;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class SaleTypeCommissionRuleRepository : ISaleTypeCommissionRuleRepository
{
    private readonly IMongoCollection<SaleTypeCommissionRule> _collection;

    public SaleTypeCommissionRuleRepository(MongoDbContext context)
    {
        _collection = context.SaleTypeCommissionRules;
    }

    public async Task<SaleTypeCommissionRule?> GetByIdAsync(string id)
    {
        return await _collection.Find(r => r.Id == id).FirstOrDefaultAsync();
    }

    public async Task<SaleTypeCommissionRule?> GetBySaleTypeAsync(string saleType)
    {
        return await _collection.Find(r => r.SaleType == saleType).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<SaleTypeCommissionRule>> GetAllAsync()
    {
        return await _collection.Find(_ => true).ToListAsync();
    }

    public async Task<SaleTypeCommissionRule> CreateAsync(SaleTypeCommissionRule rule)
    {
        rule.CreatedAt = DateTime.UtcNow;
        rule.UpdatedAt = DateTime.UtcNow;
        await _collection.InsertOneAsync(rule);
        return rule;
    }

    public async Task<SaleTypeCommissionRule> UpdateAsync(SaleTypeCommissionRule rule)
    {
        rule.UpdatedAt = DateTime.UtcNow;
        await _collection.ReplaceOneAsync(r => r.Id == rule.Id, rule);
        return rule;
    }

    public async Task<SaleTypeCommissionRule> UpsertBySaleTypeAsync(SaleTypeCommissionRule rule)
    {
        var existing = await GetBySaleTypeAsync(rule.SaleType);
        if (existing != null)
        {
            rule.Id = existing.Id;
            rule.CreatedAt = existing.CreatedAt;
            return await UpdateAsync(rule);
        }
        return await CreateAsync(rule);
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _collection.DeleteOneAsync(r => r.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<bool> DeleteBySaleTypeAsync(string saleType)
    {
        var result = await _collection.DeleteOneAsync(r => r.SaleType == saleType);
        return result.DeletedCount > 0;
    }

    public async Task<bool> ExistsAsync(string id)
    {
        var count = await _collection.CountDocumentsAsync(r => r.Id == id);
        return count > 0;
    }

    /// <summary>
    /// Inicializa las reglas por defecto según el documento de especificaciones
    /// </summary>
    public async Task SeedDefaultRulesAsync()
    {
        var existingRules = await GetAllAsync();
        if (existingRules.Any())
        {
            return; // Ya hay reglas configuradas, no sobrescribir
        }

        var defaultRules = new List<SaleTypeCommissionRule>
        {
            new() { SaleType = "entrega", SaleTypeLabel = "ENTREGA", VendorRate = 2.5m, ReferrerRate = 0m },
            new() { SaleType = "encargo_entrega", SaleTypeLabel = "ENCARGO/ENTREGA", VendorRate = 2.5m, ReferrerRate = 0m },
            new() { SaleType = "delivery_express", SaleTypeLabel = "DELIVERY EXPRESS", VendorRate = 2.5m, ReferrerRate = 0m },
            new() { SaleType = "retiro_tienda", SaleTypeLabel = "RETIRO POR TIENDA (RxT)", VendorRate = 2.5m, ReferrerRate = 0m },
            new() { SaleType = "retiro_almacen", SaleTypeLabel = "RETIRO POR ALMACÉN (RxA)", VendorRate = 2.5m, ReferrerRate = 0m },
            new() { SaleType = "encargo", SaleTypeLabel = "ENCARGO", VendorRate = 2m, ReferrerRate = 1m },
            new() { SaleType = "sistema_apartado", SaleTypeLabel = "SISTEMA DE APARTADO (SA)", VendorRate = 1.5m, ReferrerRate = 1.5m },
        };

        foreach (var rule in defaultRules)
        {
            await CreateAsync(rule);
        }
    }
}
