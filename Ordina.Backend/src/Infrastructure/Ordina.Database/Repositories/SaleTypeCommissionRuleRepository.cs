using MongoDB.Driver;
using Ordina.Database.Entities.Commission;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class SaleTypeCommissionRuleRepository : ISaleTypeCommissionRuleRepository
{
    private static readonly decimal[] TierValues = { 2.5m, 5m, 7.5m };

    private readonly IMongoCollection<SaleTypeCommissionRule> _collection;
    private readonly SemaphoreSlim _prepareGate = new(1, 1);
    private volatile bool _prepared;

    public SaleTypeCommissionRuleRepository(MongoDbContext context)
    {
        _collection = context.SaleTypeCommissionRules;
    }

    public async Task<SaleTypeCommissionRule?> GetByIdAsync(string id)
    {
        await EnsurePreparedAsync().ConfigureAwait(false);
        return await _collection.Find(r => r.Id == id).FirstOrDefaultAsync().ConfigureAwait(false);
    }

    public async Task<SaleTypeCommissionRule?> GetBySaleTypeAndTierAsync(string saleType, decimal familyCommissionUsdPerUnit)
    {
        await EnsurePreparedAsync().ConfigureAwait(false);
        var st = saleType.Trim();
        return await _collection.Find(r =>
                r.SaleType == st &&
                r.FamilyCommissionUsdPerUnit == familyCommissionUsdPerUnit)
            .FirstOrDefaultAsync()
            .ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<SaleTypeCommissionRule>> GetAllBySaleTypeAsync(string saleType)
    {
        await EnsurePreparedAsync().ConfigureAwait(false);
        var st = saleType.Trim();
        return await _collection.Find(r => r.SaleType == st)
            .SortBy(r => r.FamilyCommissionUsdPerUnit)
            .ToListAsync()
            .ConfigureAwait(false);
    }

    public async Task<IEnumerable<SaleTypeCommissionRule>> GetAllAsync()
    {
        await EnsurePreparedAsync().ConfigureAwait(false);
        var sort = Builders<SaleTypeCommissionRule>.Sort
            .Ascending(r => r.SaleType)
            .Ascending(r => r.FamilyCommissionUsdPerUnit);
        return await _collection.Find(_ => true)
            .Sort(sort)
            .ToListAsync()
            .ConfigureAwait(false);
    }

    public async Task<SaleTypeCommissionRule> CreateAsync(SaleTypeCommissionRule rule)
    {
        await EnsurePreparedAsync().ConfigureAwait(false);
        rule.CreatedAt = DateTime.UtcNow;
        rule.UpdatedAt = DateTime.UtcNow;
        await _collection.InsertOneAsync(rule).ConfigureAwait(false);
        return rule;
    }

    public async Task<SaleTypeCommissionRule> UpdateAsync(SaleTypeCommissionRule rule)
    {
        await EnsurePreparedAsync().ConfigureAwait(false);
        rule.UpdatedAt = DateTime.UtcNow;
        await _collection.ReplaceOneAsync(r => r.Id == rule.Id, rule).ConfigureAwait(false);
        return rule;
    }

    public async Task<SaleTypeCommissionRule> UpsertBySaleTypeAndTierAsync(SaleTypeCommissionRule rule)
    {
        await EnsurePreparedAsync().ConfigureAwait(false);
        var existing = await GetBySaleTypeAndTierAsync(rule.SaleType, rule.FamilyCommissionUsdPerUnit)
            .ConfigureAwait(false);
        if (existing != null)
        {
            rule.Id = existing.Id;
            rule.CreatedAt = existing.CreatedAt;
            return await UpdateAsync(rule).ConfigureAwait(false);
        }

        return await CreateAsync(rule).ConfigureAwait(false);
    }

    public async Task<bool> DeleteAsync(string id)
    {
        await EnsurePreparedAsync().ConfigureAwait(false);
        var result = await _collection.DeleteOneAsync(r => r.Id == id).ConfigureAwait(false);
        return result.DeletedCount > 0;
    }

    public async Task<long> DeleteAllBySaleTypeAsync(string saleType)
    {
        await EnsurePreparedAsync().ConfigureAwait(false);
        var result = await _collection.DeleteManyAsync(r => r.SaleType == saleType.Trim())
            .ConfigureAwait(false);
        return result.DeletedCount;
    }

    public async Task<bool> ExistsAsync(string id)
    {
        await EnsurePreparedAsync().ConfigureAwait(false);
        var count = await _collection.CountDocumentsAsync(r => r.Id == id).ConfigureAwait(false);
        return count > 0;
    }

    /// <summary>
    /// Inicializa reglas por defecto: 7 tipos de venta × 3 niveles USD/u. % sobre la comisión familia (pool).
    /// </summary>
    public async Task SeedDefaultRulesAsync(bool forceReset = false)
    {
        await EnsurePreparedAsync().ConfigureAwait(false);
        var existingRules = await _collection.Find(_ => true).ToListAsync().ConfigureAwait(false);
        if (existingRules.Count > 0 && !forceReset)
        {
            return;
        }

        if (forceReset && existingRules.Count > 0)
        {
            await _collection.DeleteManyAsync(Builders<SaleTypeCommissionRule>.Filter.Empty)
                .ConfigureAwait(false);
        }

        var defaultRows = new (string SaleType, string Label, decimal V, decimal R, decimal P)[]
        {
            ("entrega", "ENTREGA", 100m, 0m, 0m),
            ("encargo_entrega", "ENCARGO/ENTREGA", 100m, 0m, 0m),
            ("delivery_express", "DELIVERY EXPRESS", 100m, 0m, 0m),
            ("retiro_tienda", "RETIRO POR TIENDA (RxT)", 100m, 0m, 0m),
            ("retiro_almacen", "RETIRO POR ALMACÉN (RxA)", 100m, 0m, 0m),
            ("encargo", "ENCARGO", 80m, 20m, 0m),
            ("sistema_apartado", "SISTEMA DE APARTADO (SA)", 50m, 50m, 0m),
        };

        foreach (var row in defaultRows)
        {
            foreach (var tier in TierValues)
            {
                await CreateAsync(new SaleTypeCommissionRule
                {
                    SaleType = row.SaleType,
                    SaleTypeLabel = row.Label,
                    FamilyCommissionUsdPerUnit = tier,
                    VendorRate = row.V,
                    ReferrerRate = row.R,
                    PostventaRate = row.P,
                }).ConfigureAwait(false);
            }
        }
    }

    private async Task EnsurePreparedAsync()
    {
        if (_prepared)
            return;

        await _prepareGate.WaitAsync().ConfigureAwait(false);
        try
        {
            if (_prepared)
                return;

            await MigrateLegacyRulesIfNeededAsync().ConfigureAwait(false);
            await EnsureUniqueIndexAsync().ConfigureAwait(false);
            _prepared = true;
        }
        finally
        {
            _prepareGate.Release();
        }
    }

    private async Task MigrateLegacyRulesIfNeededAsync()
    {
        var legacy = await _collection.Find(r => r.FamilyCommissionUsdPerUnit == 0m)
            .ToListAsync()
            .ConfigureAwait(false);

        foreach (var doc in legacy)
        {
            foreach (var tier in TierValues)
            {
                var clone = new SaleTypeCommissionRule
                {
                    SaleType = doc.SaleType,
                    SaleTypeLabel = doc.SaleTypeLabel,
                    FamilyCommissionUsdPerUnit = tier,
                    VendorRate = doc.VendorRate,
                    ReferrerRate = doc.ReferrerRate,
                    PostventaRate = doc.PostventaRate,
                };
                await _collection.InsertOneAsync(clone).ConfigureAwait(false);
            }

            await _collection.DeleteOneAsync(d => d.Id == doc.Id).ConfigureAwait(false);
        }
    }

    private async Task EnsureUniqueIndexAsync()
    {
        var keys = Builders<SaleTypeCommissionRule>.IndexKeys
            .Ascending(r => r.SaleType)
            .Ascending(r => r.FamilyCommissionUsdPerUnit);

        var model = new CreateIndexModel<SaleTypeCommissionRule>(
            keys,
            new CreateIndexOptions
            {
                Unique = true,
                Name = "ux_saleType_familyUsdPerUnit",
            });

        try
        {
            await _collection.Indexes.CreateOneAsync(model).ConfigureAwait(false);
        }
        catch (Exception ex) when (
            ex.Message.Contains("already exists", StringComparison.OrdinalIgnoreCase) ||
            ex.Message.Contains("IndexOptionsConflict", StringComparison.OrdinalIgnoreCase) ||
            ex.Message.Contains("duplicate key", StringComparison.OrdinalIgnoreCase))
        {
            // Índice equivalente ya existe o conflicto de nombre
        }
    }
}
