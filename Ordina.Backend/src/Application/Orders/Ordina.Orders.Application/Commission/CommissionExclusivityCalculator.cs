using Ordina.Database.Entities.Commission;
using Ordina.Database.Entities.User;

namespace Ordina.Orders.Application.Commission;

/// <summary>
/// Calcula el reparto USD de comisión según el modo de exclusividad del vendedor.
/// </summary>
public static class CommissionExclusivityCalculator
{
    public sealed record CommissionSplitResult(
        decimal VendorCommission,
        decimal ReferrerCommission,
        decimal PostventaCommission,
        decimal AppliedVendorRate,
        decimal AppliedReferrerRate,
        decimal AppliedPostventaRate);

    public static CommissionSplitResult Calculate(
        string exclusivityMode,
        bool isSharedSale,
        bool hasReferrer,
        decimal baseCommissionRate,
        int quantity,
        decimal familyCommission,
        SaleTypeCommissionRule? rule)
    {
        var mode = CommissionExclusivityModes.Normalize(exclusivityMode);
        var qty = Math.Max(quantity, 1);

        switch (mode)
        {
            case CommissionExclusivityModes.ExclusiveWithReferrer when hasReferrer:
                return CalculateExclusiveWithReferrer(baseCommissionRate, qty, familyCommission, rule);

            case CommissionExclusivityModes.Exclusive:
            case CommissionExclusivityModes.ExclusiveWithReferrer:
                return FullVendorSplit(baseCommissionRate, familyCommission);

            case CommissionExclusivityModes.Shared when isSharedSale:
                return CalculateSharedSplit(baseCommissionRate, qty, familyCommission, hasReferrer, rule);

            default:
                return FullVendorSplit(baseCommissionRate, familyCommission);
        }
    }

    private static CommissionSplitResult CalculateSharedSplit(
        decimal baseCommissionRate,
        int qty,
        decimal familyCommission,
        bool hasReferrer,
        SaleTypeCommissionRule? rule)
    {
        if (rule != null)
        {
            return new CommissionSplitResult(
                rule.VendorRate * qty,
                hasReferrer ? rule.ReferrerRate * qty : 0m,
                rule.PostventaRate * qty,
                rule.VendorRate,
                rule.ReferrerRate,
                rule.PostventaRate);
        }

        var half = familyCommission / 2;
        return new CommissionSplitResult(half, half, 0m, 50m, 50m, 0m);
    }

    private static CommissionSplitResult CalculateExclusiveWithReferrer(
        decimal baseCommissionRate,
        int qty,
        decimal familyCommission,
        SaleTypeCommissionRule? rule)
    {
        if (rule != null)
        {
            return new CommissionSplitResult(
                familyCommission,
                rule.ReferrerRate * qty,
                0m,
                baseCommissionRate,
                rule.ReferrerRate,
                0m);
        }

        var half = familyCommission / 2;
        return new CommissionSplitResult(half, half, 0m, 50m, 50m, 0m);
    }

    private static CommissionSplitResult FullVendorSplit(decimal baseCommissionRate, decimal familyCommission) =>
        new(familyCommission, 0m, 0m, 100m, 0m, 0m);
}
