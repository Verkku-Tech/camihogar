using Ordina.Database.Entities.Commission;
using Ordina.Orders.Application.Commission;

namespace Ordina.Orders.Application.Tests;

public class SaleTypeCommissionTierResolverTests
{
    [Fact]
    public void TryResolveTier_accepts_2_5_5_and_7_5()
    {
        Assert.True(SaleTypeCommissionTierResolver.TryResolveTier(2.5m, out var t));
        Assert.Equal(2.5m, t);
        Assert.True(SaleTypeCommissionTierResolver.TryResolveTier(5m, out t));
        Assert.Equal(5m, t);
        Assert.True(SaleTypeCommissionTierResolver.TryResolveTier(7.5m, out t));
        Assert.Equal(7.5m, t);
    }

    [Fact]
    public void TryResolveTier_rejects_non_tier_values()
    {
        Assert.False(SaleTypeCommissionTierResolver.TryResolveTier(4m, out _));
    }

    [Fact]
    public void PickRule_selects_rule_for_matching_tier()
    {
        var rules = new List<SaleTypeCommissionRule>
        {
            new()
            {
                SaleType = "encargo",
                FamilyCommissionUsdPerUnit = 2.5m,
                VendorRate = 80m,
                ReferrerRate = 20m,
                PostventaRate = 0m,
            },
            new()
            {
                SaleType = "encargo",
                FamilyCommissionUsdPerUnit = 5m,
                VendorRate = 70m,
                ReferrerRate = 30m,
                PostventaRate = 0m,
            },
        };

        var picked = SaleTypeCommissionTierResolver.PickRule(rules, "encargo", 5m, null);
        Assert.NotNull(picked);
        Assert.Equal(70m, picked!.VendorRate);
        Assert.Equal(30m, picked.ReferrerRate);
    }

    [Fact]
    public void PickRule_non_tier_rate_uses_2_5_bucket_then_exact_or_first()
    {
        var rules = new List<SaleTypeCommissionRule>
        {
            new()
            {
                SaleType = "encargo",
                FamilyCommissionUsdPerUnit = 2.5m,
                VendorRate = 88m,
                ReferrerRate = 12m,
                PostventaRate = 0m,
            },
        };

        var picked = SaleTypeCommissionTierResolver.PickRule(rules, "encargo", 4m, null);
        Assert.NotNull(picked);
        Assert.Equal(88m, picked!.VendorRate);
    }
}
