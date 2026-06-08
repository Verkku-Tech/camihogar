using Ordina.Database.Entities.Commission;
using Ordina.Orders.Application.Commission;

namespace Ordina.Orders.Application.Tests;

/// <summary>Verifica reparto USD/u × cantidad (no porcentajes del pool familia).</summary>
public class SaleTypeCommissionUsdDistributionTests
{
    private static (decimal vendor, decimal referrer, decimal postventa) ApplyRule(
        SaleTypeCommissionRule rule,
        int quantity)
    {
        var qty = Math.Max(quantity, 1);
        return (
            rule.VendorRate * qty,
            rule.ReferrerRate * qty,
            rule.PostventaRate * qty);
    }

    [Fact]
    public void Encargo_tier_2_5_qty_2_splits_usd_per_role()
    {
        var rule = new SaleTypeCommissionRule
        {
            SaleType = "encargo",
            FamilyCommissionUsdPerUnit = 2.5m,
            VendorRate = 2m,
            PostventaRate = 1m,
            ReferrerRate = 1.5m,
        };

        var (v, r, p) = ApplyRule(rule, 2);
        Assert.Equal(4m, v);
        Assert.Equal(3m, r);
        Assert.Equal(2m, p);
    }

    [Fact]
    public void Entrega_tier_2_5_qty_1_splits_usd_per_role()
    {
        var rule = new SaleTypeCommissionRule
        {
            SaleType = "entrega",
            FamilyCommissionUsdPerUnit = 2.5m,
            VendorRate = 2.5m,
            PostventaRate = 0m,
            ReferrerRate = 1.5m,
        };

        var (v, r, p) = ApplyRule(rule, 1);
        Assert.Equal(2.5m, v);
        Assert.Equal(1.5m, r);
        Assert.Equal(0m, p);
    }

    [Fact]
    public void PickRule_non_tier_family_commission_uses_2_5_bucket()
    {
        var rules = new List<SaleTypeCommissionRule>
        {
            new()
            {
                SaleType = "encargo",
                FamilyCommissionUsdPerUnit = 2.5m,
                VendorRate = 2m,
                PostventaRate = 1m,
                ReferrerRate = 1.5m,
            },
        };

        var picked = SaleTypeCommissionTierResolver.PickRule(rules, "encargo", 4m, null);
        Assert.NotNull(picked);
        Assert.Equal(2m, picked!.VendorRate);
    }
}
