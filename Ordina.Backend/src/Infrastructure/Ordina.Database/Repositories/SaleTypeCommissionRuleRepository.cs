using MongoDB.Driver;
using Ordina.Database.Entities.Commission;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class SaleTypeCommissionRuleRepository : ISaleTypeCommissionRuleRepository
{
    private static readonly decimal[] TierValues = { 2.5m, 5m, 7.5m };
    private const int ExpectedSaleTypeCount = 7;
    private const decimal Epsilon = 0.0001m;

    private static readonly (string SaleType, string Label)[] DeliverySaleTypes =
    {
        ("entrega", "ENTREGA"),
        ("encargo_entrega", "ENCARGO/ENTREGA"),
        ("delivery_express", "DELIVERY EXPRESS"),
        ("retiro_tienda", "RETIRO POR TIENDA (RxT)"),
        ("retiro_almacen", "RETIRO POR ALMACÉN (RxA)"),
    };

    private static readonly (decimal Tier, decimal Vendor, decimal Postventa, decimal Referrer)[] DeliveryTierUsd =
    {
        (2.5m, 2.5m, 0m, 1.5m),
        (5m, 5m, 0m, 3m),
        (7.5m, 7.5m, 0m, 3m),
    };

    private static readonly (decimal Tier, decimal Vendor, decimal Postventa, decimal Referrer)[] EncargoTierUsd =
    {
        (2.5m, 2m, 1m, 1.5m),
        (5m, 4m, 2m, 3m),
        (7.5m, 6m, 3m, 3m),
    };

    private static readonly (decimal Tier, decimal Vendor, decimal Postventa, decimal Referrer)[] ApartadoTierUsd =
    {
        (2.5m, 1.5m, 1.5m, 1.5m),
        (5m, 3m, 3m, 3m),
        (7.5m, 4.5m, 4.5m, 3m),
    };

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
    /// Inicializa reglas por defecto: 7 tipos × 3 tiers con USD fijos por rol (cuadro Excel).
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

        foreach (var rule in BuildDefaultRules())
        {
            await CreateAsync(rule).ConfigureAwait(false);
        }
    }

    public async Task<int> EnsureMissingDefaultRulesAsync()
    {
        await EnsurePreparedAsync().ConfigureAwait(false);
        var existing = await _collection.Find(_ => true).ToListAsync().ConfigureAwait(false);
        var inserted = 0;

        foreach (var rule in BuildDefaultRules())
        {
            var found = existing.Any(r =>
                r.SaleType == rule.SaleType &&
                Math.Abs(r.FamilyCommissionUsdPerUnit - rule.FamilyCommissionUsdPerUnit) < Epsilon);
            if (found)
                continue;

            await CreateAsync(rule).ConfigureAwait(false);
            inserted++;
        }

        return inserted;
    }

    public async Task<SaleTypeCommissionCompleteness> GetCompletenessAsync()
    {
        await EnsurePreparedAsync().ConfigureAwait(false);
        var rules = await _collection.Find(_ => true).ToListAsync().ConfigureAwait(false);
        var missing = new List<string>();
        var hasLegacy = rules.Any(r => r.FamilyCommissionUsdPerUnit == 0m);

        foreach (var def in BuildDefaultRules())
        {
            var ok = rules.Any(r =>
                r.SaleType == def.SaleType &&
                Math.Abs(r.FamilyCommissionUsdPerUnit - def.FamilyCommissionUsdPerUnit) < Epsilon);
            if (!ok)
            {
                missing.Add($"{def.SaleTypeLabel} · {def.FamilyCommissionUsdPerUnit} USD/u familia");
            }
        }

        var expected = ExpectedSaleTypeCount * TierValues.Length;
        return new SaleTypeCommissionCompleteness
        {
            IsComplete = missing.Count == 0 && !hasLegacy,
            ExpectedRuleCount = expected,
            ActualRuleCount = rules.Count,
            HasLegacyTierZero = hasLegacy,
            MissingDescriptions = missing,
        };
    }

    private static IEnumerable<SaleTypeCommissionRule> BuildDefaultRules()
    {
        foreach (var (saleType, label) in DeliverySaleTypes)
        {
            foreach (var (tier, vendor, postventa, referrer) in DeliveryTierUsd)
            {
                yield return CreateRule(saleType, label, tier, vendor, postventa, referrer);
            }
        }

        foreach (var (tier, vendor, postventa, referrer) in EncargoTierUsd)
        {
            yield return CreateRule("encargo", "ENCARGO", tier, vendor, postventa, referrer);
        }

        foreach (var (tier, vendor, postventa, referrer) in ApartadoTierUsd)
        {
            yield return CreateRule("sistema_apartado", "SISTEMA DE APARTADO (SA)", tier, vendor, postventa, referrer);
        }
    }

    private static SaleTypeCommissionRule CreateRule(
        string saleType,
        string label,
        decimal tier,
        decimal vendorUsd,
        decimal postventaUsd,
        decimal referrerUsd) =>
        new()
        {
            SaleType = saleType,
            SaleTypeLabel = label,
            FamilyCommissionUsdPerUnit = tier,
            VendorRate = vendorUsd,
            PostventaRate = postventaUsd,
            ReferrerRate = referrerUsd,
        };

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
