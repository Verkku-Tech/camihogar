using Ordina.Database.Entities.Commission;
using Ordina.Database.Entities.User;
using Ordina.Orders.Application.Commission;

namespace Ordina.Orders.Application.Tests;

public class CommissionExclusivityCalculatorTests
{
    private static SaleTypeCommissionRule EncargoTier25Rule() => new()
    {
        SaleType = "encargo",
        FamilyCommissionUsdPerUnit = 2.5m,
        VendorRate = 2m,
        PostventaRate = 1m,
        ReferrerRate = 1.5m,
    };

    [Theory]
    [InlineData(2.5)]
    [InlineData(5)]
    [InlineData(7.5)]
    public void Shared_mode_splits_vendor_referrer_and_postventa(decimal tier)
    {
        var rule = EncargoTier25Rule();
        rule.FamilyCommissionUsdPerUnit = (decimal)tier;
        rule.VendorRate = tier - 1.5m;
        rule.PostventaRate = 0.5m;
        rule.ReferrerRate = 1m;

        var familyCommission = tier * 2;
        var result = CommissionExclusivityCalculator.Calculate(
            CommissionExclusivityModes.Shared,
            isSharedSale: true,
            hasReferrer: true,
            baseCommissionRate: (decimal)tier,
            quantity: 2,
            familyCommission,
            rule);

        Assert.Equal(rule.VendorRate * 2, result.VendorCommission);
        Assert.Equal(rule.ReferrerRate * 2, result.ReferrerCommission);
        Assert.Equal(rule.PostventaRate * 2, result.PostventaCommission);
    }

    [Fact]
    public void Exclusive_mode_gives_full_family_to_vendor()
    {
        var rule = EncargoTier25Rule();
        var result = CommissionExclusivityCalculator.Calculate(
            CommissionExclusivityModes.Exclusive,
            isSharedSale: true,
            hasReferrer: true,
            baseCommissionRate: 2.5m,
            quantity: 2,
            familyCommission: 5m,
            rule);

        Assert.Equal(5m, result.VendorCommission);
        Assert.Equal(0m, result.ReferrerCommission);
        Assert.Equal(0m, result.PostventaCommission);
    }

    [Fact]
    public void Exclusive_with_referrer_splits_with_referrer_and_absorbs_postventa()
    {
        var rule = EncargoTier25Rule();
        var result = CommissionExclusivityCalculator.Calculate(
            CommissionExclusivityModes.ExclusiveWithReferrer,
            isSharedSale: true,
            hasReferrer: true,
            baseCommissionRate: 2.5m,
            quantity: 2,
            familyCommission: 5m,
            rule);

        Assert.Equal(6m, result.VendorCommission);
        Assert.Equal(3m, result.ReferrerCommission);
        Assert.Equal(0m, result.PostventaCommission);
        Assert.Equal(3m, result.AppliedVendorRate);
        Assert.Equal(1.5m, result.AppliedReferrerRate);
        Assert.Equal(0m, result.AppliedPostventaRate);
    }

    [Fact]
    public void Exclusive_with_referrer_without_referrer_gives_full_family_to_vendor()
    {
        var rule = EncargoTier25Rule();
        var result = CommissionExclusivityCalculator.Calculate(
            CommissionExclusivityModes.ExclusiveWithReferrer,
            isSharedSale: false,
            hasReferrer: false,
            baseCommissionRate: 7.5m,
            quantity: 1,
            familyCommission: 7.5m,
            rule);

        Assert.Equal(7.5m, result.VendorCommission);
        Assert.Equal(0m, result.ReferrerCommission);
        Assert.Equal(0m, result.PostventaCommission);
    }

    [Fact]
    public void Exclusive_with_referrer_encargo_tier_7_5_matches_daniela_scenario()
    {
        var rule = new SaleTypeCommissionRule
        {
            SaleType = "encargo",
            FamilyCommissionUsdPerUnit = 7.5m,
            VendorRate = 5m,
            PostventaRate = 1.5m,
            ReferrerRate = 1m,
        };

        var result = CommissionExclusivityCalculator.Calculate(
            CommissionExclusivityModes.ExclusiveWithReferrer,
            isSharedSale: true,
            hasReferrer: true,
            baseCommissionRate: 7.5m,
            quantity: 1,
            familyCommission: 7.5m,
            rule);

        Assert.Equal(6.5m, result.VendorCommission);
        Assert.Equal(1m, result.ReferrerCommission);
        Assert.Equal(0m, result.PostventaCommission);
        Assert.Equal(7.5m, result.VendorCommission + result.ReferrerCommission);
    }

    [Fact]
    public void Exclusive_with_referrer_without_rule_falls_back_to_half_split()
    {
        var result = CommissionExclusivityCalculator.Calculate(
            CommissionExclusivityModes.ExclusiveWithReferrer,
            isSharedSale: true,
            hasReferrer: true,
            baseCommissionRate: 2.5m,
            quantity: 2,
            familyCommission: 5m,
            rule: null);

        Assert.Equal(2.5m, result.VendorCommission);
        Assert.Equal(2.5m, result.ReferrerCommission);
        Assert.Equal(0m, result.PostventaCommission);
    }
}
