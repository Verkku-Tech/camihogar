using Ordina.Application.Commissions;
using Ordina.Domain.Finance;
using Ordina.Domain.Orders;
using Ordina.Domain.Users;
using Xunit;

namespace Ordina.Application.Tests;

public class CommissionCalculatorTests
{
    [Theory]
    [InlineData(2.5, true, 2.5)]
    [InlineData(5.0, true, 5.0)]
    [InlineData(7.5, true, 7.5)]
    [InlineData(3.0, false, 0.0)]
    public void TryResolveTier_MatchesExpectedTiers(decimal input, bool expectedSuccess, decimal expectedTier)
    {
        var success = SaleTypeCommissionTierResolver.TryResolveTier(input, out var tier);
        Assert.Equal(expectedSuccess, success);
        if (expectedSuccess)
        {
            Assert.Equal(expectedTier, tier);
        }
    }

    [Fact]
    public void PickRule_FindsMatchingRuleBySaleTypeAndTier()
    {
        var rules = new List<SaleTypeCommissionRule>
        {
            new() { SaleType = "entrega", FamilyCommissionUsdPerUnit = 2.5m, VendorRate = 1.5m, ReferrerRate = 1.0m, PostventaRate = 0m },
            new() { SaleType = "entrega", FamilyCommissionUsdPerUnit = 5.0m, VendorRate = 3.0m, ReferrerRate = 2.0m, PostventaRate = 0m },
            new() { SaleType = "encargo", FamilyCommissionUsdPerUnit = 2.5m, VendorRate = 1.0m, ReferrerRate = 1.0m, PostventaRate = 0.5m }
        };

        var matchedRule = SaleTypeCommissionTierResolver.PickRule(rules, "entrega", 5.0m);
        Assert.NotNull(matchedRule);
        Assert.Equal(5.0m, matchedRule.FamilyCommissionUsdPerUnit);
        Assert.Equal(3.0m, matchedRule.VendorRate);
    }

    [Fact]
    public void Calculate_ExclusiveVendor_ReceivesFullCommission()
    {
        var rule = new SaleTypeCommissionRule
        {
            SaleType = "entrega",
            FamilyCommissionUsdPerUnit = 5.0m,
            VendorRate = 3.0m,
            ReferrerRate = 2.0m,
            PostventaRate = 0m
        };

        var result = CommissionExclusivityCalculator.Calculate(
            exclusivityMode: CommissionExclusivityModes.Exclusive,
            isSharedSale: true,
            hasReferrer: true,
            baseCommissionRate: 5.0m,
            quantity: 2,
            familyCommission: 10.0m,
            rule: rule);

        Assert.Equal(10.0m, result.VendorCommission);
        Assert.Equal(0m, result.ReferrerCommission);
        Assert.Equal(0m, result.PostventaCommission);
    }

    [Fact]
    public void Calculate_SharedSale_DistributesAccordingToRule()
    {
        var rule = new SaleTypeCommissionRule
        {
            SaleType = "encargo",
            FamilyCommissionUsdPerUnit = 5.0m,
            VendorRate = 2.5m,
            ReferrerRate = 1.5m,
            PostventaRate = 1.0m
        };

        var result = CommissionExclusivityCalculator.Calculate(
            exclusivityMode: CommissionExclusivityModes.Shared,
            isSharedSale: true,
            hasReferrer: true,
            baseCommissionRate: 5.0m,
            quantity: 3,
            familyCommission: 15.0m,
            rule: rule);

        Assert.Equal(7.5m, result.VendorCommission);    // 2.5 * 3
        Assert.Equal(4.5m, result.ReferrerCommission);  // 1.5 * 3
        Assert.Equal(3.0m, result.PostventaCommission); // 1.0 * 3
    }

    [Fact]
    public void ClassifyLines_IdentifiesUnchangedAndModifiedLines()
    {
        var baseline = new List<OrderProduct>
        {
            new() { Id = "cat1-1000-abc", Quantity = 1, Name = "Silla" },
            new() { Id = "cat2-1000-xyz", Quantity = 2, Name = "Mesa" }
        };

        var final = new List<OrderProduct>
        {
            new() { Id = "cat1-1000-abc", Quantity = 1, Name = "Silla" }, // unchanged
            new() { Id = "cat2-1000-xyz", Quantity = 3, Name = "Mesa" }  // modified quantity
        };

        CommissionLineClassifier.ClassifyLines(baseline, final);

        Assert.Equal(CommissionLineSources.ReservationUnchanged, final[0].CommissionLineSource);
        Assert.Equal(CommissionLineSources.StoreModified, final[1].CommissionLineSource);
    }
}
