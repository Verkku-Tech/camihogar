namespace Ordina.Database.Repositories;

/// <summary>Estado de las 21 reglas esperadas (7 tipos × 3 tiers USD/u familia).</summary>
public sealed class SaleTypeCommissionCompleteness
{
    public bool IsComplete { get; init; }
    public int ExpectedRuleCount { get; init; }
    public int ActualRuleCount { get; init; }
    public bool HasLegacyTierZero { get; init; }
    public IReadOnlyList<string> MissingDescriptions { get; init; } = Array.Empty<string>();
}
